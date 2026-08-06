import { formatCurrencyBRL } from "@/lib/products/format";

export function MoneyDisplay({
  value
}: {
  value: number | string | null | undefined;
}) {
  return <span>{formatCurrencyBRL(value)}</span>;
}
