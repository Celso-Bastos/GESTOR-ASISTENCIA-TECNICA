import { redirect } from "next/navigation";
import { getCurrentOrganization } from "@/lib/organization/queries";
import { OrganizationForm } from "./organization-form";

export default async function OrganizationOnboardingPage() {
  const organization = await getCurrentOrganization();

  if (organization) {
    redirect("/dashboard");
  }

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          Primeiro acesso
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Criar organizacao
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Cadastre a loja inicial para liberar o dashboard e vincular seu
          usuario como owner.
        </p>
      </div>

      <OrganizationForm />
    </section>
  );
}
