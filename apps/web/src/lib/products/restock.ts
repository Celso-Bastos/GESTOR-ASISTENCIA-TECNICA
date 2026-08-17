import {
  formatProductCategoryLabel,
  type ProductCategory
} from "@/lib/products/format";

export type RestockSourceRow = {
  category: ProductCategory;
  custom_model_name: string | null;
  quantity: number | string;
  total_price: number | string;
  product_model_templates:
    | {
        id?: string;
        model_name: string;
      }
    | Array<{
        id?: string;
        model_name: string;
      }>
    | null;
};

export type GroupedRestockRow = {
  category: ProductCategory;
  categoryLabel: string;
  model: string;
  quantity: number;
  total: number;
};

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

export function getOutflowModelName(outflow: RestockSourceRow) {
  const template = singleRelation(outflow.product_model_templates);

  return template?.model_name ?? outflow.custom_model_name ?? "Sem modelo";
}

export function groupRestockOutflows(outflows: RestockSourceRow[]) {
  const grouped = new Map<string, GroupedRestockRow>();

  for (const outflow of outflows) {
    const model = getOutflowModelName(outflow).trim() || "Sem modelo";
    const key = `${outflow.category}::${model.toLowerCase()}`;
    const current = grouped.get(key) ?? {
      category: outflow.category,
      categoryLabel: formatProductCategoryLabel(outflow.category),
      model,
      quantity: 0,
      total: 0
    };

    current.quantity += Number(outflow.quantity);
    current.total += toAmount(outflow.total_price);
    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.category === right.category) {
      return left.model.localeCompare(right.model, "pt-BR");
    }

    return left.category.localeCompare(right.category);
  });
}
