import "server-only";

const missingSchemaCodes = new Set(["42703", "42P01", "42883", "PGRST202", "PGRST204", "PGRST205"]);

export function getInventoryErrorMessage(error: { code?: string }, fallback: string) {
  return error.code && missingSchemaCodes.has(error.code)
    ? "Estrutura de estoque indisponível no banco. Verifique se a migration 0017_complete_inventory.sql foi aplicada integralmente neste ambiente."
    : fallback;
}
