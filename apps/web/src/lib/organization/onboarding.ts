import "server-only";
import { requireAuth } from "@/lib/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getApprovedRequestServiceCity() {
  const user = await requireAuth();
  const { data, error } = await createAdminClient().from("account_requests")
    .select("service_city")
    .eq("auth_user_id", user.id)
    .eq("status", "approved")
    .is("review_started_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle<{ service_city: string | null }>();
  if (error) throw new Error("Não foi possível carregar a cidade da solicitação aprovada.");
  return data?.service_city ?? null;
}
