/** Sugestão para novas organizações; nunca recalcula um endereço já salvo. */
export function suggestOrganizationSlug(name: string) {
  return name.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
