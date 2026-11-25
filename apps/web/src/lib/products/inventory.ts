import { productCategoryLabels, type ProductCategory } from "./format";

export type InventoryItem = {
  id: string;
  category: ProductCategory;
  model_name: string;
  stock_quantity: number;
  minimum_stock: number;
  unit_cost: number | string | null;
  default_price: number | string | null;
  is_active: boolean;
};

export const inventoryMovementLabels = {
  opening_balance: "Estoque inicial",
  entry: "Entrada",
  outflow: "Venda/saída",
  adjustment: "Ajuste"
} as const;

export type InventoryMovementType = keyof typeof inventoryMovementLabels;

export function getStockStatus(quantity: number, minimum: number) {
  if (quantity < 0) return "NEGATIVO";
  if (quantity === 0) return "ESGOTADO";
  if (quantity <= minimum) return "BAIXO";
  return "OK";
}

export function getInventorySummary(items: InventoryItem[]) {
  return items.reduce((summary, item) => {
    summary.units += item.stock_quantity;
    if (item.stock_quantity < item.minimum_stock) summary.belowMinimum++;
    if (item.stock_quantity === 0) summary.empty++;
    if (item.stock_quantity < 0) summary.negative++;
    // Divergências negativas não são ativos; custo não informado é omitido.
    if (item.unit_cost !== null) summary.value += Math.max(item.stock_quantity, 0) * Number(item.unit_cost);
    return summary;
  }, { units: 0, belowMinimum: 0, empty: 0, negative: 0, value: 0 });
}

export function getStockRestock(items: InventoryItem[]) {
  return items.filter(item => item.is_active && item.stock_quantity < item.minimum_stock)
    .map(item => ({ ...item, suggested: item.minimum_stock - item.stock_quantity }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.model_name.localeCompare(b.model_name, "pt-BR"));
}

export function formatStockRestockList(items: InventoryItem[]) {
  const rows = getStockRestock(items);
  if (!rows.length) return "Nenhum produto precisa de reposição neste filtro.";
  const lines = ["Olá! Segue a lista de reposição:"];
  let category = "";
  for (const item of rows) {
    if (category !== item.category) { category = item.category; lines.push("", productCategoryLabels[item.category]); }
    lines.push(`• ${item.model_name} — repor ${item.suggested}`);
  }
  lines.push("", `Total de modelos: ${rows.length}`, `Total de unidades: ${rows.reduce((n,item) => n+item.suggested,0)}`);
  return lines.join("\n");
}
