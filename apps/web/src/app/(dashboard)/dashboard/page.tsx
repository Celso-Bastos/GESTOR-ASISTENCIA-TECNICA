import Link from "next/link";
import type { ElementType } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  DollarSign,
  PackageSearch,
  Smartphone,
  Users,
  Zap
} from "lucide-react";
import {
  dashboardPeriods,
  formatPercentage,
  getDashboardMetrics,
  safeDivide,
  type DashboardAlertOrder,
  type DashboardProductRow
} from "@/lib/dashboard/metrics";
import {
  formatCurrencyBRL,
  formatDateBR
} from "@/lib/products/format";
import { maintenanceStatusLabels } from "@/lib/maintenance/status";

type DashboardPageProps = {
  searchParams?: Promise<{
    period?: string;
    start?: string;
    end?: string;
  }>;
};

type MetricCardProps = {
  label: string;
  value: string | number;
  detail?: string;
  icon: ElementType;
  tone?: "teal" | "emerald" | "amber" | "rose" | "indigo" | "slate";
  trend?: number | null;
};

const periodLabels: Record<(typeof dashboardPeriods)[number], string> = {
  today: "Hoje",
  this_week: "Esta semana",
  this_month: "Mes atual",
  last_month: "Mes passado",
  custom: "Personalizado"
};

const toneClasses = {
  teal: "bg-accent-soft text-accent",
  emerald: "bg-success-soft text-success",
  amber: "bg-warning-soft text-warning",
  rose: "bg-rose-soft text-rose",
  indigo: "bg-indigo-soft text-indigo",
  slate: "bg-canvas text-body"
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function Trend({ value }: { value?: number | null }) {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return (
      <span className="mt-3 inline-flex text-xs font-medium text-subtle">
        Sem base no periodo anterior
      </span>
    );
  }

  const positive = value >= 0;
  const Icon = positive ? ArrowUpRight : ArrowDownRight;

  return (
    <span
      className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${
        positive ? "text-success" : "text-rose"
      }`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {formatPercentage(value)} vs. periodo anterior
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "slate",
  trend
}: MetricCardProps) {
  return (
    <article className="rounded-md border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mt-3 break-words text-2xl font-semibold text-foreground sm:text-3xl">
            {value}
          </p>
        </div>
        <div className={`grid size-10 shrink-0 place-items-center rounded-md ${toneClasses[tone]}`}>
          <Icon className="size-5" aria-hidden="true" />
        </div>
      </div>
      {detail ? <p className="mt-2 text-xs leading-5 text-subtle">{detail}</p> : null}
      <Trend value={trend} />
    </article>
  );
}

function SectionTitle({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function ProductRanking({
  title,
  rows,
  mode
}: {
  title: string;
  rows: DashboardProductRow[];
  mode: "quantity" | "revenue";
}) {
  const max = rows.reduce(
    (current, row) => Math.max(current, mode === "quantity" ? row.quantity : row.total),
    0
  );

  return (
    <section className="rounded-md border border-line bg-surface p-4 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhuma venda no periodo.</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {rows.map((row) => {
            const value = mode === "quantity" ? row.quantity : row.total;
            const width = `${Math.max(safeDivide(value, max) * 100, 8)}%`;

            return (
              <div className="grid gap-2" key={`${row.category}-${row.model}`}>
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{row.model}</p>
                    <p className="text-xs text-subtle">{row.categoryLabel}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-body">
                    {mode === "quantity"
                      ? `${formatNumber(row.quantity)} un.`
                      : formatCurrencyBRL(row.total)}
                  </p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-canvas">
                  <div className="h-full rounded-full bg-teal-600" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RestockTable({ rows }: { rows: DashboardProductRow[] }) {
  return (
    <section className="rounded-md border border-line bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-foreground">Itens para repor</h3>
        <Link
          className="inline-flex h-11 items-center justify-center rounded-md border border-accent-line px-3 text-sm font-semibold text-accent transition hover:bg-accent-soft hover:text-accent-strong focus:outline-none focus:ring-2 focus:ring-focus sm:h-auto sm:border-0 sm:p-0"
          href="/relatorios/reposicao"
        >
          Ver relatorio
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nenhum item vendido no periodo.</p>
      ) : (
        <>
          <div className="mt-4 grid gap-3 md:hidden">
            {rows.map((row) => (
              <article
                className="grid gap-3 rounded-md border border-line bg-surface-muted p-3"
                key={`${row.category}-${row.model}`}
              >
                <div>
                  <p className="text-xs font-medium uppercase text-subtle">
                    {row.categoryLabel}
                  </p>
                  <h4 className="mt-1 break-words text-sm font-semibold text-foreground">
                    {row.model}
                  </h4>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs font-medium uppercase text-subtle">
                      Quantidade
                    </dt>
                    <dd className="mt-1 text-content">
                      {formatNumber(row.quantity)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-subtle">
                      Total vendido
                    </dt>
                    <dd className="mt-1 font-semibold text-foreground">
                      {formatCurrencyBRL(row.total)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="mt-4 hidden overflow-x-auto md:block">
            <table className="min-w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-subtle">
              <tr>
                <th className="py-3 pr-4 font-semibold">Produto</th>
                <th className="py-3 pr-4 font-semibold">Modelo</th>
                <th className="py-3 pr-4 font-semibold">Qtd.</th>
                <th className="py-3 font-semibold">Total vendido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {rows.map((row) => (
                <tr key={`${row.category}-${row.model}`}>
                  <td className="py-3 pr-4 text-body">{row.categoryLabel}</td>
                  <td className="py-3 pr-4 font-medium text-foreground">{row.model}</td>
                  <td className="py-3 pr-4 text-body">{formatNumber(row.quantity)}</td>
                  <td className="py-3 font-semibold text-foreground">
                    {formatCurrencyBRL(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function AlertList({
  title,
  emptyMessage,
  orders,
  dateKind
}: {
  title: string;
  emptyMessage: string;
  orders: DashboardAlertOrder[];
  dateKind: "delivery" | "warranty";
}) {
  return (
    <section className="rounded-md border border-line bg-surface p-4 shadow-sm">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{emptyMessage}</p>
      ) : (
        <div className="mt-4 grid gap-3">
          {orders.map((order) => (
            <Link
              className="grid gap-2 rounded-md border border-line p-3 transition hover:border-accent-line hover:bg-accent-soft/40 focus:outline-none focus:ring-2 focus:ring-focus"
              href={`/manutencoes/${order.id}`}
              key={order.id}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-foreground">{order.orderNumber}</p>
                <span className="rounded-md bg-canvas px-2 py-1 text-xs font-medium text-body">
                  {maintenanceStatusLabels[order.status]}
                </span>
              </div>
              <p className="text-sm text-body">
                {order.customerName} - {order.deviceModel}
              </p>
              <p className="text-xs text-subtle">
                {dateKind === "delivery"
                  ? `Previsao: ${formatDateBR(order.expectedDeliveryDate)}`
                  : `Garantia: ${formatDateBR(order.warrantyExpiresAt)}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const metrics = await getDashboardMetrics(params);

  return (
    <section className="grid gap-6">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <p className="text-sm font-medium uppercase text-accent">
            {metrics.organization.name}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            Visao geral do desempenho da assistencia com faturamento,
            manutencoes, vendas e clientes da organizacao atual.
          </p>
        </div>

        <Link
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus sm:w-auto"
          href="/manutencoes/rapida"
        >
          <Zap className="size-4" aria-hidden="true" />
          Nova manutencao rapida
        </Link>
      </div>

      <form className="grid gap-3 rounded-md border border-line bg-surface p-4 shadow-sm md:grid-cols-[minmax(12rem,1fr)_minmax(10rem,12rem)_minmax(10rem,12rem)_auto] md:items-end">
        <label className="grid gap-2 text-sm font-medium text-body">
          Periodo
          <select
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
            defaultValue={metrics.range.period}
            name="period"
          >
            {dashboardPeriods.map((period) => (
              <option key={period} value={period}>
                {periodLabels[period]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Inicio custom
          <input
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
            defaultValue={metrics.range.start}
            name="start"
            type="date"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Fim custom
          <input
            className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
            defaultValue={metrics.range.end}
            name="end"
            type="date"
          />
        </label>

        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-neutral-action-strong px-4 text-sm font-semibold text-white transition hover:bg-neutral-action-hover focus:outline-none focus:ring-2 focus:ring-line-strong md:w-auto"
          type="submit"
        >
          <CalendarDays className="size-4" aria-hidden="true" />
          Filtrar
        </button>
      </form>

      <div className="rounded-md border border-indigo-line bg-indigo-soft px-4 py-3 text-sm text-indigo-strong">
        Periodo analisado: <strong>{metrics.range.label}</strong> (
        {formatDateBR(metrics.range.start)} a {formatDateBR(metrics.range.end)}).
        Os valores abaixo representam receita/faturamento, nao lucro real.
      </div>

      <DashboardBlock title="Resumo financeiro" error={metrics.errors.financial}>
        <SectionTitle
          title="Resumo financeiro"
          description="Receita de manutencoes entregues e saidas registradas no periodo."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            detail="Manutencoes + vendas/saidas."
            icon={DollarSign}
            label="Faturamento total"
            tone="emerald"
            trend={metrics.comparisons.revenueChange}
            value={formatCurrencyBRL(metrics.financial.totalRevenue)}
          />
          <MetricCard
            detail={`${formatNumber(metrics.financial.paidMaintenanceCount)} manutencoes pagas/concluidas.`}
            icon={Smartphone}
            label="Receita com manutencoes"
            tone="teal"
            value={formatCurrencyBRL(metrics.financial.maintenanceRevenue)}
          />
          <MetricCard
            detail={`${formatNumber(metrics.financial.saleRecordCount)} registros de saida.`}
            icon={PackageSearch}
            label="Receita com vendas"
            tone="indigo"
            trend={metrics.comparisons.salesRevenueChange}
            value={formatCurrencyBRL(metrics.financial.salesRevenue)}
          />
          <MetricCard
            detail="Media por manutencao entregue com valor final."
            icon={DollarSign}
            label="Ticket medio manutencao"
            tone="slate"
            value={formatCurrencyBRL(metrics.financial.averageMaintenanceTicket)}
          />
          <MetricCard
            detail="Media por registro de saida no MVP."
            icon={DollarSign}
            label="Ticket medio venda"
            tone="amber"
            value={formatCurrencyBRL(metrics.financial.averageSaleTicketByRecord)}
          />
        </div>
      </DashboardBlock>

      <DashboardBlock title="Operacao de manutencoes" error={metrics.errors.operations}>
        <SectionTitle
          title="Operacao de manutencoes"
          description="Leitura operacional das ordens ativas, entregas e garantias."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Smartphone}
            label="Manutencoes abertas"
            tone="teal"
            value={formatNumber(metrics.operations.openMaintenance)}
          />
          <MetricCard
            icon={CalendarDays}
            label="Entregues no periodo"
            tone="emerald"
            trend={metrics.comparisons.deliveredMaintenanceChange}
            value={formatNumber(metrics.operations.deliveredInPeriod)}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Manutencoes atrasadas"
            tone="rose"
            value={formatNumber(metrics.operations.overdue)}
          />
          <MetricCard
            icon={Smartphone}
            label="Prontas para entrega"
            tone="indigo"
            value={formatNumber(metrics.operations.readyForDelivery)}
          />
          <MetricCard
            icon={PackageSearch}
            label="Aguardando peca"
            tone="amber"
            value={formatNumber(metrics.operations.waitingParts)}
          />
          <MetricCard
            icon={CalendarDays}
            label="Garantias ativas"
            tone="emerald"
            value={formatNumber(metrics.operations.activeWarranties)}
          />
          <MetricCard
            icon={AlertTriangle}
            label="Garantias vencidas"
            tone="rose"
            value={formatNumber(metrics.operations.expiredWarranties)}
          />
          <MetricCard
            detail="Vencem nos proximos 7 dias."
            icon={CalendarDays}
            label="Garantias vencendo"
            tone="amber"
            value={formatNumber(metrics.operations.expiringWarranties)}
          />
        </div>
      </DashboardBlock>

      <DashboardBlock title="Vendas e reposicao" error={metrics.errors.sales}>
        <SectionTitle
          title="Vendas e reposicao"
          description="Produtos vendidos agrupados por categoria e modelo para apoiar recompra."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={PackageSearch}
            label="Unidades vendidas"
            tone="indigo"
            value={formatNumber(metrics.sales.totalUnits)}
          />
          <MetricCard
            icon={PackageSearch}
            label="Registros de saida"
            tone="slate"
            value={formatNumber(metrics.sales.outflowRecords)}
          />
          <MetricCard
            icon={PackageSearch}
            label="Categoria mais vendida"
            tone="teal"
            value={metrics.sales.topCategory}
          />
          <MetricCard
            icon={PackageSearch}
            label="Produto/modelo mais vendido"
            tone="amber"
            value={metrics.sales.topProduct}
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ProductRanking
            mode="quantity"
            rows={metrics.sales.topByQuantity}
            title="Top 5 por quantidade"
          />
          <ProductRanking
            mode="revenue"
            rows={metrics.sales.topByRevenue}
            title="Top 5 por faturamento"
          />
        </div>
        <RestockTable rows={metrics.sales.restockItems} />
      </DashboardBlock>

      <DashboardBlock title="Clientes" error={metrics.errors.customers}>
        <SectionTitle
          title="Clientes"
          description="Base ativa, novos cadastros e sinais simples de relacionamento."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={Users}
            label="Clientes novos"
            tone="teal"
            value={formatNumber(metrics.customers.newInPeriod)}
          />
          <MetricCard
            icon={Users}
            label="Clientes ativos"
            tone="slate"
            value={formatNumber(metrics.customers.activeTotal)}
          />
          <MetricCard
            detail="Autorizacao registrada no cadastro."
            icon={Users}
            label="WhatsApp autorizado"
            tone="emerald"
            value={formatNumber(metrics.customers.whatsappOptIn)}
          />
          <MetricCard
            icon={Users}
            label="Vindos do quiosque"
            tone="indigo"
            value={formatNumber(metrics.customers.fromTabletInPeriod)}
          />
          <MetricCard
            detail="Clientes com mais de uma manutencao."
            icon={Users}
            label="Clientes recorrentes"
            tone="amber"
            value={formatNumber(metrics.customers.recurring)}
          />
        </div>
      </DashboardBlock>

      <DashboardBlock title="Alertas importantes" error={metrics.errors.alerts}>
        <SectionTitle
          title="Alertas importantes"
          description="Listas curtas para priorizar atendimento manual no balcao."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          <AlertList
            dateKind="delivery"
            emptyMessage="Nenhuma manutencao atrasada."
            orders={metrics.alerts.overdue}
            title="Atrasadas"
          />
          <AlertList
            dateKind="delivery"
            emptyMessage="Nenhuma ordem pronta para entrega."
            orders={metrics.alerts.readyForDelivery}
            title="Prontas para entrega"
          />
          <AlertList
            dateKind="warranty"
            emptyMessage="Nenhuma garantia vencendo nos proximos 7 dias."
            orders={metrics.alerts.warrantyExpiring}
            title="Garantias vencendo"
          />
        </div>
      </DashboardBlock>
    </section>
  );
}

function DashboardBlock({ title, error, children }: { title: string; error: boolean; children: React.ReactNode }) {
  return <section className="grid gap-4">
    {error ? <div role="alert" className="rounded-md border border-warning-line bg-warning-soft p-4 text-warning-emphasis">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p>Não foi possível carregar este bloco. Os valores estão indisponíveis; atualize a página para tentar novamente.</p>
    </div> : children}
  </section>;
}
