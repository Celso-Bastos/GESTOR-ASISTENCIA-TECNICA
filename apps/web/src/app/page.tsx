import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/queries";
import { getCurrentOrganization } from "@/lib/organization/queries";

export default async function Home() {
  await requireAuth();

  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/onboarding/organizacao");
  }

  redirect("/dashboard");
}
