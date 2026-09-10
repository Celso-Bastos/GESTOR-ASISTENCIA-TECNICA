import { maintenanceStatusLabels, type MaintenanceStatus } from "@/lib/maintenance/status";
import { formatWarrantyPeriod } from "@/lib/maintenance/warranty";
import type { MessageVariables } from "./interpolation";
type Relation<T> = T | T[] | null;
type Order = {
  order_number: string; status: MaintenanceStatus; expected_delivery_date: string | null;
  warranty_amount: number | null; warranty_unit: string | null; warranty_expires_at: string | null;
  customers: Relation<{ name: string; phone: string | null }>;
  devices: Relation<{ model: string }>;
};
function single<T>(value: Relation<T>) { return Array.isArray(value) ? value[0] : value; }
function date(value: string | null) { return value ? value.split("-").reverse().join("/") : ""; }
export function buildOrderMessageVariables({ order, organizationName }: { order: Order; organizationName: string }): MessageVariables {
  const customer = single(order.customers);
  return {
    cliente_nome: customer?.name, cliente_telefone: customer?.phone,
    aparelho_modelo: single(order.devices)?.model, numero_ordem: order.order_number,
    status: maintenanceStatusLabels[order.status], data_entrega: date(order.expected_delivery_date),
    loja_nome: organizationName, garantia_periodo: formatWarrantyPeriod(order.warranty_amount, order.warranty_unit),
    garantia_validade: date(order.warranty_expires_at)
  };
}
