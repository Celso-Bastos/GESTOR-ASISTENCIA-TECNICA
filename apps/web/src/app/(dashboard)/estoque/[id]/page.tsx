import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth/queries";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import type { InventoryItem } from "@/lib/products/inventory";
import { getInventoryErrorMessage } from "@/lib/products/inventory-errors";
import { InventoryMovementForm } from "../inventory-movement-form";
import { InventoryNavigation } from "../inventory-navigation";
import { StockStatusBadge } from "../stock-status-badge";

function InventoryProductError({ message }: { message: string }) {
  return <section className="grid gap-5">
    <h1 className="text-2xl font-semibold text-foreground">Movimentar estoque</h1>
    <InventoryNavigation />
    <p role="alert" className="rounded-md border border-danger-line bg-danger-soft p-4 text-danger">{message}</p>
  </section>;
}

export default async function InventoryProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ tipo?: string | string[] }>;
}) {
  await requireAuth();
  const organization = await requireOrganization();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { tipo } = await searchParams;
  const type = tipo === "adjustment" || tipo === "opening_balance" ? tipo : "entry";
  const supabase = await createClient();
  const { data: item, error } = await supabase.from("product_model_templates")
    .select("id, category, model_name, stock_quantity, minimum_stock, unit_cost, default_price, is_active")
    .eq("id", id).eq("organization_id", organization.id).is("deleted_at", null).maybeSingle<InventoryItem>();
  if (error) return <InventoryProductError message={getInventoryErrorMessage(error, "Não foi possível carregar o produto. Tente novamente.")} />;
  if (!item) notFound();
  const { data: opening, error: openingError } = await supabase.from("inventory_movements").select("id")
    .eq("organization_id", organization.id).eq("product_model_template_id", id).eq("movement_type", "opening_balance").maybeSingle();
  if (openingError) return <InventoryProductError message={getInventoryErrorMessage(openingError, "Não foi possível conferir o estoque inicial. Tente novamente.")} />;
  return <section className="grid gap-5"><h1 className="break-words text-2xl font-semibold text-foreground">{item.model_name}</h1><InventoryNavigation />
    <p className="text-body">Saldo atual: <strong>{item.stock_quantity} un.</strong> · Mínimo: {item.minimum_stock}</p><div><StockStatusBadge quantity={item.stock_quantity} minimum={item.minimum_stock} /></div>
    <InventoryMovementForm key={`${item.id}:${type}`} item={{ id: item.id }} initialType={type} hasOpening={Boolean(opening)} />
  </section>;
}
