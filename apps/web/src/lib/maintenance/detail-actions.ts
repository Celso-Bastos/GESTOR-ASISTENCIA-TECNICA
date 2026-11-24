"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/queries";
import { requireOrganization } from "@/lib/organization/queries";
import { createClient } from "@/lib/supabase/server";
import { maintenanceStatusLabels, type MaintenanceStatus } from "./status";
import { resolveMaintenanceFinalPrice } from "./pricing";
import { getMaintenanceActionContext } from "./action-context";
import type { MaintenanceActionState } from "./types";
import { deleteMaintenanceOrderSchema, updateMaintenanceStatusSchema } from "@/lib/validations/maintenance-status.schema";

async function changeMaintenanceStatus(
  orderId: string,
  newStatus: MaintenanceStatus,
  description?: string
): Promise<MaintenanceActionState> {
  const context = await getMaintenanceActionContext();

  if (!context.ok) {
    return { error: context.error };
  }

  const { organization, userId } = context;
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select("id, order_number, status, delivered_at, estimated_price, final_price")
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      order_number: string;
      status: MaintenanceStatus;
      delivered_at: string | null;
      estimated_price: number | string | null;
      final_price: number | string | null;
    }>();

  if (orderError || !order) {
    return { error: "Manutenção não encontrada para esta organização." };
  }

  const finalPrice = resolveMaintenanceFinalPrice(newStatus, order.estimated_price, order.final_price);
  const fillsFinalPrice = newStatus === "entregue" && order.final_price == null && finalPrice != null;
  if (order.status === newStatus && !fillsFinalPrice) {
    return { success: "A manutenção já está neste status." };
  }

  const updatePayload: {
    status: MaintenanceStatus;
    delivered_at?: string | null;
    final_price?: number | string | null;
  } = {
    status: newStatus
  };

  if (newStatus === "entregue") {
    updatePayload.delivered_at = order.status === "entregue"
      ? order.delivered_at ?? new Date().toISOString() : new Date().toISOString();
    if (fillsFinalPrice) updatePayload.final_price = finalPrice;
  } else if (order.status === "entregue") {
    updatePayload.delivered_at = null;
  }

  let statusUpdate = supabase
    .from("maintenance_orders")
    .update(updatePayload)
    .eq("id", orderId)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .eq("status", order.status);
  if (fillsFinalPrice) {
    statusUpdate = statusUpdate.is("final_price", null)
      .eq("estimated_price", order.estimated_price!);
  }
  const { data: updated, error } = await statusUpdate.select("id").maybeSingle<{ id: string }>();

  if (error || !updated) {
    return { error: "Não foi possível alterar o status da manutenção." };
  }

  const oldLabel = maintenanceStatusLabels[order.status];
  const newLabel = maintenanceStatusLabels[newStatus];

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    organization_id: organization.id,
    maintenance_order_id: order.id,
    event_type: order.status === newStatus ? "maintenance_updated" : "status_changed",
    old_status: order.status,
    new_status: newStatus,
    description: order.status === newStatus
      ? `Valor final da ordem ${order.order_number} preenchido com o valor estimado.`
      : description ||
      `Status da ordem ${order.order_number} alterado de ${oldLabel} para ${newLabel}.`,
    created_by: userId
  });

  if (eventError) {
    return {
      error: "Status atualizado, mas não foi possível registrar o histórico."
    };
  }

  revalidatePath("/manutencoes");
  revalidatePath(`/manutencoes/${orderId}`);
  revalidatePath("/dashboard");

  return { success: "Status atualizado." };
}

export async function updateMaintenanceStatusAction(
  orderId: string,
  _prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  const parsed = updateMaintenanceStatusSchema.safeParse({
    new_status: String(formData.get("new_status") ?? ""),
    description: String(formData.get("description") ?? "")
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Selecione um status válido."
    };
  }

  return changeMaintenanceStatus(
    orderId,
    parsed.data.new_status,
    parsed.data.description
  );
}

export async function markMaintenanceAsDeliveredAction(
  orderId: string,
  prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  void prevState;
  void formData;

  return changeMaintenanceStatus(
    orderId,
    "entregue",
    "Ordem marcada como entregue."
  );
}

export async function cancelMaintenanceOrderAction(
  orderId: string,
  prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  void prevState;
  void formData;

  return changeMaintenanceStatus(
    orderId,
    "cancelado",
    "Ordem cancelada pela equipe."
  );
}

export async function deleteMaintenanceOrderAction(
  orderId: string,
  prevState: MaintenanceActionState,
  formData: FormData
): Promise<MaintenanceActionState> {
  void prevState;
  void formData;

  const parsed = deleteMaintenanceOrderSchema.safeParse({
    maintenance_order_id: orderId
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Manutenção inválida."
    };
  }

  const user = await requireAuth();
  const organization = await requireOrganization();
  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("maintenance_orders")
    .select("id, order_number, status, deleted_at")
    .eq("id", parsed.data.maintenance_order_id)
    .eq("organization_id", organization.id)
    .maybeSingle<{
      id: string;
      order_number: string;
      status: MaintenanceStatus;
      deleted_at: string | null;
    }>();

  if (orderError) {
    console.error("Erro ao buscar manutenção para exclusão:", orderError);
    return { error: "Não foi possível localizar a manutenção." };
  }

  if (!order) {
    return { error: "Manutenção não encontrada para esta organização." };
  }

  if (order.deleted_at) {
    revalidatePath("/manutencoes");
    revalidatePath("/dashboard");
    redirect("/manutencoes");
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from("maintenance_orders")
    .update({
      deleted_at: now,
      updated_at: now
    })
    .eq("id", order.id)
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (updateError || !updated) {
    console.error("Erro ao excluir manutenção por soft delete:", updateError);
    return { error: "Não foi possível excluir a manutenção." };
  }

  const { error: eventError } = await supabase.from("maintenance_events").insert({
    organization_id: organization.id,
    maintenance_order_id: order.id,
    event_type: "maintenance_deleted",
    old_status: order.status,
    new_status: null,
    description: "Ordem de serviço excluída por soft delete.",
    created_by: user.id,
    created_at: now
  });

  if (eventError) {
    console.error("Erro ao registrar evento de exclusão da manutenção:", eventError);
    return {
      error:
        "A manutenção foi removida das listas, mas não foi possível registrar o histórico."
    };
  }

  revalidatePath("/manutencoes");
  revalidatePath(`/manutencoes/${order.id}`);
  revalidatePath("/dashboard");
  redirect("/manutencoes");
}
