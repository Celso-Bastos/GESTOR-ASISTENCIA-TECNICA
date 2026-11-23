import { getInventoryItems } from "./actions";
import { InventoryNavigation } from "./inventory-navigation";
import { InventoryOverview } from "./inventory-overview";

export default async function EstoquePage() {
  const { items, error } = await getInventoryItems();
  return <section className="grid gap-6"><div><h1 className="text-2xl font-semibold text-foreground">Estoque</h1><p className="mt-2 text-sm text-muted">Confira saldos, registre entradas e acompanhe a reposição.</p></div><InventoryNavigation />
    {error ? <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-4 text-danger">{error}</p> : <InventoryOverview items={items} />}
  </section>;
}
