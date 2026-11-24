import { requireOrganization } from "@/lib/organization/queries";
import Link from "next/link";
import { ServiceCityForm } from "./service-city-form";
import { OrganizationSiteForm } from "./site-form";
import { getOrganizationWarrantyDocument } from "@/lib/organization/warranty-document-queries";
import { canManageWarrantyDocument } from "@/lib/organization/warranty-document";
import { buildWarrantyDocumentMessage } from "@/lib/maintenance/warranty-document-sharing";
import { WarrantyDocumentControls } from "@/components/warranty-document-controls";
import { WarrantyDocumentForm } from "./warranty-document-form";

export default async function ConfiguracoesPage() {
  const organization = await requireOrganization();
  const { document, error: documentError } = await getOrganizationWarrantyDocument();

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

      <div id="termo-garantia" className="grid min-w-0 max-w-2xl gap-4 rounded-md border border-line bg-surface p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-foreground">Termo de garantia</h2>
        <p className="text-sm text-muted">Documento utilizado para informar ao cliente as condições gerais de garantia dos serviços. O documento digital é uma cópia informativa das condições gerais. O termo físico continua sendo assinado presencialmente pelo cliente.</p>
        {documentError ? <p role="alert" className="text-sm text-danger">{documentError}</p> : document ? <>
          <p className="break-all text-sm text-body">Documento atual: <strong>{document.name}</strong></p>
          <p className="text-xs text-muted">Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(document.updatedAt))}</p>
          <WarrantyDocumentControls key={document.updatedAt} name={document.name} message={buildWarrantyDocumentMessage({})} />
        </> : <p className="text-sm text-muted">Nenhum termo de garantia configurado.</p>}
        {canManageWarrantyDocument(organization.role) ? <WarrantyDocumentForm hasDocument={Boolean(document)} /> : <p className="text-sm text-muted">Solicite ao owner ou admin a substituição do documento.</p>}
      </div>

      <Link
        className="inline-flex h-11 w-fit items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
        href="/configuracoes/quiosque"
      >
        Quiosque / Tablet
      </Link>
    </section>
  );
}
