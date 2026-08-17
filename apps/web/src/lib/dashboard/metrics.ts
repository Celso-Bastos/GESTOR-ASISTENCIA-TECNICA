import { requireAuth } from "@/lib/auth/queries";
import { isOpenMaintenanceStatus, type MaintenanceStatus } from "@/lib/maintenance/status";
import {
  formatProductCategoryLabel,
  type ProductCategory
} from "@/lib/products/format";
import {
  groupRestockOutflows,
  type GroupedRestockRow
} from "@/lib/products/restock";
import { requireOrganization, type CurrentOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";

export const dashboardPeriods = [
  "today",
  "this_week",
  "this_month",
  "last_month",
  "custom"
] as const;

export type DashboardPeriod = (typeof dashboardPeriods)[number];

export type DashboardRange = {
  period: DashboardPeriod;
  label: string;
  start: string;
  end: string;
  startDateTime: string;
  endDateTimeExclusive: string;
  previous: {
    start: string;
    end: string;
    startDateTime: string;
    endDateTimeExclusive: string;
  };
};

type DashboardInput = {
  period?: string;
  start?: string;
  end?: string;
};

type MaintenanceDashboardRow = {
  id: string;
  order_number: string;
  status: MaintenanceStatus;
  expected_delivery_date: string | null;
  delivered_at: string | null;
  final_price: number | string | null;
  warranty_enabled: boolean;
  warranty_signed: boolean;
  warranty_expires_at: string | null;
  customer_id: string;
  created_at: string;
  customers:
    | {
        id: string;
        name: string;
        phone: string;
        phone_normalized: string;
      }
    | Array<{
        id: string;
        name: string;
        phone: string;
        phone_normalized: string;
      }>
    | null;
  devices:
    | {
        id: string;
        brand: string | null;
        model: string;
      }
    | Array<{
        id: string;
        brand: string | null;
        model: string;
      }>
    | null;
};

type ProductOutflowDashboardRow = {
  id: string;
  category: ProductCategory;
  custom_model_name: string | null;
  quantity: number;
  total_price: number | string;
  sold_at: string;
  product_model_templates:
    | {
        id: string;
        model_name: string;
      }
    | Array<{
        id: string;
        model_name: string;
      }>
    | null;
};

type CustomerDashboardRow = {
  id: string;
  created_at: string;
  whatsapp_opt_in: boolean | null;
  source: string;
};

export type DashboardProductRow = GroupedRestockRow;

export type DashboardAlertOrder = {
  id: string;
  orderNumber: string;
  status: MaintenanceStatus;
  expectedDeliveryDate: string | null;
  warrantyExpiresAt: string | null;
  customerName: string;
  deviceModel: string;
};

export type DashboardMetrics = {
  organization: CurrentOrganization;
  range: DashboardRange;
  financial: {
    totalRevenue: number;
    maintenanceRevenue: number;
    salesRevenue: number;
    averageMaintenanceTicket: number;
    averageSaleTicketByRecord: number;
    paidMaintenanceCount: number;
    saleRecordCount: number;
  };
  operations: {
    openMaintenance: number;
    deliveredInPeriod: number;
    overdue: number;
    readyForDelivery: number;
    waitingParts: number;
    activeWarranties: number;
    expiredWarranties: number;
    expiringWarranties: number;
  };
  sales: {
    totalUnits: number;
    outflowRecords: number;
    topCategory: string;
    topProduct: string;
    topByQuantity: DashboardProductRow[];
    topByRevenue: DashboardProductRow[];
    restockItems: DashboardProductRow[];
  };
  customers: {
    newInPeriod: number;
    activeTotal: number;
    whatsappOptIn: number;
    fromTabletInPeriod: number;
    recurring: number;
  };
  comparisons: {
    revenueChange: number | null;
    salesRevenueChange: number | null;
    deliveredMaintenanceChange: number | null;
  };
  alerts: {
    overdue: DashboardAlertOrder[];
    readyForDelivery: DashboardAlertOrder[];
    warrantyExpiring: DashboardAlertOrder[];
  };
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SAO_PAULO_OFFSET = "-03:00";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const MAINTENANCE_SELECT =
  "id, order_number, status, expected_delivery_date, delivered_at, final_price, warranty_enabled, warranty_signed, warranty_expires_at, customer_id, created_at, customers(id, name, phone, phone_normalized), devices(id, brand, model)";

const OUTFLOW_SELECT =
  "id, category, custom_model_name, quantity, total_price, sold_at, product_model_templates(id, model_name)";

export function safeDivide(value: number, divisor: number) {
  return divisor > 0 ? value / divisor : 0;
}

export function formatPercentage(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "Sem base anterior";
  }

  const sign = value > 0 ? "+" : "";

  return `${sign}${new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function singleRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toAmount(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function localDateFromString(value: string) {
  return new Date(`${value}T12:00:00${SAO_PAULO_OFFSET}`);
}

function startDateTime(value: string) {
  return new Date(`${value}T00:00:00${SAO_PAULO_OFFSET}`).toISOString();
}

function endDateTimeExclusive(value: string) {
  return addDays(value, 1, "T00:00:00").toISOString();
}

function addDays(value: string, days: number, time = "T12:00:00") {
  const date = new Date(`${value}${time}${SAO_PAULO_OFFSET}`);
  date.setUTCDate(date.getUTCDate() + days);

  return date;
}

function formatDateOnly(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function todayISO() {
  return formatDateOnly(new Date());
}

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = formatDateOnly(new Date(Date.UTC(year, month, 0, 15)));

  return { start, end };
}

function labelForRange(period: DashboardPeriod, start: string, end: string) {
  if (period === "today") {
    return "Hoje";
  }

  if (period === "this_week") {
    return "Esta semana";
  }

  if (period === "this_month") {
    return "Mes atual";
  }

  if (period === "last_month") {
    return "Mes passado";
  }

  return `${start} a ${end}`;
}

function isValidDateRange(start?: string, end?: string) {
  return (
    Boolean(start && end) &&
    DATE_RE.test(start ?? "") &&
    DATE_RE.test(end ?? "") &&
    localDateFromString(start ?? "").getTime() <=
      localDateFromString(end ?? "").getTime()
  );
}

function normalizePeriod(value?: string): DashboardPeriod {
  return dashboardPeriods.includes(value as DashboardPeriod)
    ? (value as DashboardPeriod)
    : "this_month";
}

export function getDateRangeFromPeriod(input?: DashboardInput): DashboardRange {
  let period = normalizePeriod(input?.period);
  const today = todayISO();
  const todayDate = localDateFromString(today);
  const currentYear = todayDate.getUTCFullYear();
  const currentMonth = todayDate.getUTCMonth() + 1;
  let start = today;
  let end = today;

  if (period === "this_week") {
    const day = todayDate.getUTCDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    start = formatDateOnly(addDays(today, mondayOffset));
    end = formatDateOnly(addDays(start, 6));
  } else if (period === "this_month") {
    ({ start, end } = monthBounds(currentYear, currentMonth));
  } else if (period === "last_month") {
    const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    ({ start, end } = monthBounds(previousYear, previousMonth));
  } else if (period === "custom") {
    if (isValidDateRange(input?.start, input?.end)) {
      start = input?.start ?? start;
      end = input?.end ?? end;
    } else {
      period = "this_month";
      ({ start, end } = monthBounds(currentYear, currentMonth));
    }
  }

  const daysInRange =
    Math.round(
      (localDateFromString(end).getTime() - localDateFromString(start).getTime()) /
        DAY_IN_MS
    ) + 1;
  const previousEnd = formatDateOnly(addDays(start, -1));
  const previousStart = formatDateOnly(addDays(previousEnd, -(daysInRange - 1)));

  return {
    period,
    label: labelForRange(period, start, end),
    start,
    end,
    startDateTime: startDateTime(start),
    endDateTimeExclusive: endDateTimeExclusive(end),
    previous: {
      start: previousStart,
      end: previousEnd,
      startDateTime: startDateTime(previousStart),
      endDateTimeExclusive: endDateTimeExclusive(previousEnd)
    }
  };
}

function isDateTimeInRange(
  value: string | null | undefined,
  range: Pick<DashboardRange, "startDateTime" | "endDateTimeExclusive">
) {
  if (!value) {
    return false;
  }

  return value >= range.startDateTime && value < range.endDateTimeExclusive;
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

function groupProductRows(outflows: ProductOutflowDashboardRow[]) {
  return groupRestockOutflows(outflows);
}

function alertOrder(row: MaintenanceDashboardRow): DashboardAlertOrder {
  const customer = singleRelation(row.customers);
  const device = singleRelation(row.devices);

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    expectedDeliveryDate: row.expected_delivery_date,
    warrantyExpiresAt: row.warranty_expires_at,
    customerName: customer?.name ?? "Cliente nao encontrado",
    deviceModel: device?.model ?? "Aparelho nao encontrado"
  };
}

function sortByDate(value: "expected_delivery_date" | "warranty_expires_at") {
  return (left: MaintenanceDashboardRow, right: MaintenanceDashboardRow) =>
    String(left[value] ?? "").localeCompare(String(right[value] ?? ""));
}

export async function getDashboardMetrics(input?: DashboardInput): Promise<DashboardMetrics> {
  await requireAuth();
  const organization = await requireOrganization();
  const range = getDateRangeFromPeriod(input);
  const supabase = await createClient();
  const today = todayISO();
  const warrantyWindowEnd = formatDateOnly(addDays(today, 7));

  const [maintenanceResult, currentOutflowsResult, previousOutflowsResult, customersResult] =
    await Promise.all([
      supabase
        .from("maintenance_orders")
        .select(MAINTENANCE_SELECT)
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .limit(5000)
        .returns<MaintenanceDashboardRow[]>(),
      supabase
        .from("product_outflows")
        .select(OUTFLOW_SELECT)
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .gte("sold_at", range.start)
        .lte("sold_at", range.end)
        .limit(5000)
        .returns<ProductOutflowDashboardRow[]>(),
      supabase
        .from("product_outflows")
        .select(OUTFLOW_SELECT)
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .gte("sold_at", range.previous.start)
        .lte("sold_at", range.previous.end)
        .limit(5000)
        .returns<ProductOutflowDashboardRow[]>(),
      supabase
        .from("customers")
        .select("id, created_at, whatsapp_opt_in, source")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .limit(5000)
        .returns<CustomerDashboardRow[]>()
    ]);

  if (maintenanceResult.error) {
    console.error("Erro ao carregar metricas de manutencao:", maintenanceResult.error);
  }

  if (currentOutflowsResult.error) {
    console.error("Erro ao carregar metricas de saidas:", currentOutflowsResult.error);
  }

  if (previousOutflowsResult.error) {
    console.error("Erro ao carregar comparativo de saidas:", previousOutflowsResult.error);
  }

  if (customersResult.error) {
    console.error("Erro ao carregar metricas de clientes:", customersResult.error);
  }

  const maintenanceRows = maintenanceResult.data ?? [];
  const currentOutflows = currentOutflowsResult.data ?? [];
  const previousOutflows = previousOutflowsResult.data ?? [];
  const customers = customersResult.data ?? [];

  const deliveredInPeriodRows = maintenanceRows.filter(
    (row) => row.status === "entregue" && isDateTimeInRange(row.delivered_at, range)
  );
  const previousDeliveredRows = maintenanceRows.filter(
    (row) =>
      row.status === "entregue" &&
      isDateTimeInRange(row.delivered_at, range.previous)
  );
  const paidMaintenanceRows = deliveredInPeriodRows.filter(
    (row) => row.final_price !== null
  );
  const previousPaidMaintenanceRows = previousDeliveredRows.filter(
    (row) => row.final_price !== null
  );
  const maintenanceRevenue = paidMaintenanceRows.reduce(
    (sum, row) => sum + toAmount(row.final_price),
    0
  );
  const previousMaintenanceRevenue = previousPaidMaintenanceRows.reduce(
    (sum, row) => sum + toAmount(row.final_price),
    0
  );
  const salesRevenue = currentOutflows.reduce(
    (sum, outflow) => sum + toAmount(outflow.total_price),
    0
  );
  const previousSalesRevenue = previousOutflows.reduce(
    (sum, outflow) => sum + toAmount(outflow.total_price),
    0
  );
  const totalRevenue = maintenanceRevenue + salesRevenue;
  const previousTotalRevenue = previousMaintenanceRevenue + previousSalesRevenue;

  const groupedProducts = groupProductRows(currentOutflows);
  const topByQuantity = [...groupedProducts]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
  const topByRevenue = [...groupedProducts]
    .sort((left, right) => right.total - left.total)
    .slice(0, 5);
  const categoryTotals = new Map<ProductCategory, number>();

  for (const row of groupedProducts) {
    categoryTotals.set(row.category, (categoryTotals.get(row.category) ?? 0) + row.quantity);
  }

  const topCategory =
    Array.from(categoryTotals.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null;

  const customerMaintenanceCounts = new Map<string, number>();

  for (const row of maintenanceRows) {
    customerMaintenanceCounts.set(
      row.customer_id,
      (customerMaintenanceCounts.get(row.customer_id) ?? 0) + 1
    );
  }

  const openMaintenanceRows = maintenanceRows.filter((row) =>
    isOpenMaintenanceStatus(row.status)
  );
  const overdueRows = openMaintenanceRows
    .filter((row) => row.expected_delivery_date !== null && row.expected_delivery_date < today)
    .sort(sortByDate("expected_delivery_date"));
  const readyRows = openMaintenanceRows
    .filter((row) => row.status === "pronto_para_entrega")
    .sort(sortByDate("expected_delivery_date"));
  const warrantyExpiringRows = maintenanceRows
    .filter(
      (row) =>
        row.warranty_enabled &&
        row.warranty_signed &&
        row.warranty_expires_at !== null &&
        row.warranty_expires_at >= today &&
        row.warranty_expires_at <= warrantyWindowEnd
    )
    .sort(sortByDate("warranty_expires_at"));

  return {
    organization,
    range,
    financial: {
      totalRevenue,
      maintenanceRevenue,
      salesRevenue,
      averageMaintenanceTicket: safeDivide(
        maintenanceRevenue,
        paidMaintenanceRows.length
      ),
      averageSaleTicketByRecord: safeDivide(salesRevenue, currentOutflows.length),
      paidMaintenanceCount: paidMaintenanceRows.length,
      saleRecordCount: currentOutflows.length
    },
    operations: {
      openMaintenance: openMaintenanceRows.length,
      deliveredInPeriod: deliveredInPeriodRows.length,
      overdue: overdueRows.length,
      readyForDelivery: readyRows.length,
      waitingParts: openMaintenanceRows.filter((row) => row.status === "aguardando_peca").length,
      activeWarranties: maintenanceRows.filter(
        (row) =>
          row.warranty_enabled &&
          row.warranty_signed &&
          row.warranty_expires_at !== null &&
          row.warranty_expires_at >= today
      ).length,
      expiredWarranties: maintenanceRows.filter(
        (row) =>
          row.warranty_enabled &&
          row.warranty_signed &&
          row.warranty_expires_at !== null &&
          row.warranty_expires_at < today
      ).length,
      expiringWarranties: warrantyExpiringRows.length
    },
    sales: {
      totalUnits: currentOutflows.reduce(
        (sum, outflow) => sum + Number(outflow.quantity),
        0
      ),
      outflowRecords: currentOutflows.length,
      topCategory: topCategory ? formatProductCategoryLabel(topCategory) : "Sem vendas",
      topProduct: topByQuantity[0]?.model ?? "Sem vendas",
      topByQuantity,
      topByRevenue,
      restockItems: topByQuantity
    },
    customers: {
      newInPeriod: customers.filter((customer) =>
        isDateTimeInRange(customer.created_at, range)
      ).length,
      activeTotal: customers.length,
      whatsappOptIn: customers.filter((customer) => customer.whatsapp_opt_in).length,
      fromTabletInPeriod: customers.filter(
        (customer) =>
          customer.source === "tablet" && isDateTimeInRange(customer.created_at, range)
      ).length,
      recurring: Array.from(customerMaintenanceCounts.values()).filter((count) => count > 1).length
    },
    comparisons: {
      revenueChange: percentChange(totalRevenue, previousTotalRevenue),
      salesRevenueChange: percentChange(salesRevenue, previousSalesRevenue),
      deliveredMaintenanceChange: percentChange(
        deliveredInPeriodRows.length,
        previousDeliveredRows.length
      )
    },
    alerts: {
      overdue: overdueRows.slice(0, 5).map(alertOrder),
      readyForDelivery: readyRows.slice(0, 5).map(alertOrder),
      warrantyExpiring: warrantyExpiringRows.slice(0, 5).map(alertOrder)
    }
  };
}
