import { getStockStatus } from "@/lib/products/inventory";

export function StockStatusBadge({ quantity, minimum }: { quantity: number; minimum: number }) {
  const status = getStockStatus(quantity, minimum);
  const color = status === "OK" ? "border-success-line bg-success-soft text-success"
    : status === "BAIXO" ? "border-warning-line bg-warning-soft text-warning-strong"
    : "border-danger-line bg-danger-soft text-danger";
  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-semibold ${color}`}>
    {status === "NEGATIVO" ? "ESTOQUE NEGATIVO" : status}
  </span>;
}
