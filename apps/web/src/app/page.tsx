import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/queries";
import { getCurrentOrganization } from "@/lib/organization/queries";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const organization = await getCurrentOrganization();

  if (!organization) {
    redirect("/onboarding/organizacao");
  }

  redirect("/dashboard");
}
