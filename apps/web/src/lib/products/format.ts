export const productCategories = [
  "charger",
  "earphone",
  "bluetooth_earphone",
  "screen_protector",
  "privacy_screen_protector",
  "cable",
  "case",
  "keyboard",
  "other"
] as const;

export type ProductCategory = (typeof productCategories)[number];

export const productCategoryLabels: Record<ProductCategory, string> = {
  charger: "Carregador",
  earphone: "Fone",
  bluetooth_earphone: "Fone Bluetooth",
  screen_protector: "Película",
  privacy_screen_protector: "Película privativa",
  cable: "Cabo",
  case: "Case",
  keyboard: "Teclado",
  other: "Outro"
};

export const productCategoryBasePrices: Record<ProductCategory, number | null> = {
  charger: 30,
  earphone: null,
  bluetooth_earphone: null,
  screen_protector: 10,
  privacy_screen_protector: 20,
  cable: 15,
  case: 20,
  keyboard: null,
  other: null
};

export function formatProductCategoryLabel(category: ProductCategory | string) {
  return productCategoryLabels[category as ProductCategory] ?? "Outro";
}

export function getProductCategoryBasePrice(
  category: ProductCategory | string
) {
  return productCategoryBasePrices[category as ProductCategory] ?? null;
}

export function getSuggestedUnitPrice(
  category: ProductCategory | string,
  selectedModel?: { default_price?: number | string | null } | null
) {
  const modelPrice = parseCurrencyInput(selectedModel?.default_price);

  if (modelPrice !== undefined) {
    return modelPrice;
  }

  return getProductCategoryBasePrice(category) ?? 0;
}

export function formatCurrencyBRL(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function parseCurrencyInput(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return value;
  }

  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatDateBR(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeZone: "America/Sao_Paulo"
  }).format(new Date(`${value}T00:00:00`));
}

export function currentMonthRange() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  const start = `${values.year}-${values.month}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = `${values.year}-${values.month}-${String(endDate.getUTCDate()).padStart(2, "0")}`;

  return { start, end, month: `${values.year}-${values.month}` };
}
