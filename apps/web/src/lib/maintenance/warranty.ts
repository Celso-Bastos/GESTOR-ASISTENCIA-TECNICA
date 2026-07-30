export const warrantyUnits = ["days", "months"] as const;

export type WarrantyUnit = (typeof warrantyUnits)[number];

export function parseWarrantyUnit(value: string | null | undefined) {
  return warrantyUnits.includes(value as WarrantyUnit)
    ? (value as WarrantyUnit)
    : null;
}

function parseISODate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("Informe uma data de inicio da garantia valida.");
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Informe uma data de inicio da garantia valida.");
  }

  return date;
}

function toISODate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function calculateWarrantyExpiration(
  startDate: string,
  amount: number,
  unit: WarrantyUnit
) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Informe uma quantidade de garantia maior que zero.");
  }

  const date = parseISODate(startDate);

  if (unit === "days") {
    date.setUTCDate(date.getUTCDate() + amount);
  } else {
    date.setUTCMonth(date.getUTCMonth() + amount);
  }

  return toISODate(date);
}

export function formatWarrantyPeriod(
  amount: number | string | null | undefined,
  unit: string | null | undefined
) {
  const numericAmount = Number(amount);
  const parsedUnit = parseWarrantyUnit(unit);

  if (!Number.isInteger(numericAmount) || numericAmount <= 0 || !parsedUnit) {
    return "";
  }

  const label =
    parsedUnit === "days"
      ? numericAmount === 1
        ? "dia"
        : "dias"
      : numericAmount === 1
        ? "mes"
        : "meses";

  return `${numericAmount} ${label}`;
}

export function isWarrantyExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) {
    return false;
  }

  const today = new Date();
  const todayISO = toISODate(
    new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
    )
  );

  return expiresAt < todayISO;
}
