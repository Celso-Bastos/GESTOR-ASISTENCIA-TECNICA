import { requireOrganization } from "@/lib/organization/queries";
import Link from "next/link";
import { ServiceCityForm } from "./service-city-form";
import { OrganizationSiteForm } from "./site-form";

export default async function ConfiguracoesPage() {
  const organization = await requireOrganization();

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-accent">
          Configuracoes
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Dados da organizacao
        </h1>
      </div>

      <dl className="grid min-w-0 max-w-2xl gap-4 break-words rounded-md border border-line bg-surface p-4 shadow-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">Nome</dt>
          <dd className="mt-1 text-sm text-foreground">{organization.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Telefone
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            {organization.phone || "Nao informado"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-subtle">
            Seu papel
          </dt>
          <dd className="mt-1 text-sm text-foreground">{organization.role}</dd>
        </div>
      </dl>

      {organization.role === "owner" || organization.role === "admin" ? (
        <OrganizationSiteForm slug={organization.slug} />
      ) : (
        <div className="grid min-w-0 max-w-2xl gap-2 rounded-md border border-line bg-surface p-4 text-sm text-body">
          <p className="break-all">Site da loja: {organization.slug}</p>
          <p className="text-muted">Identificador do site da loja. O site público da loja ainda não está disponível. Solicite ao owner ou admin qualquer alteração.</p>
        </div>
      )}

      {organization.role === "owner" || organization.role === "admin" ? (
        <ServiceCityForm serviceCity={organization.service_city} />
      ) : (
        <p className="max-w-2xl text-sm text-body">Cidade de serviço: {organization.service_city || "Não informada"}. Solicite ao owner ou admin qualquer alteração.</p>
      )}

      <Link
        className="inline-flex h-11 w-fit items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
        href="/configuracoes/quiosque"
      >
        Quiosque / Tablet
      </Link>
    </section>
  );
}
