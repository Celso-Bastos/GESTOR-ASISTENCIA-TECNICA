import { requireOrganization } from "@/lib/organization/queries";

export default async function ConfiguracoesPage() {
  const organization = await requireOrganization();

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">
          Configuracoes
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Dados da organizacao
        </h1>
      </div>

      <dl className="grid max-w-2xl gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Nome</dt>
          <dd className="mt-1 text-sm text-slate-950">{organization.name}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">Slug</dt>
          <dd className="mt-1 text-sm text-slate-950">{organization.slug}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Telefone
          </dt>
          <dd className="mt-1 text-sm text-slate-950">
            {organization.phone || "Nao informado"}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-slate-500">
            Seu papel
          </dt>
          <dd className="mt-1 text-sm text-slate-950">{organization.role}</dd>
        </div>
      </dl>

      <p className="max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
        Configuracoes avancadas serao adicionadas depois, junto com permissoes
        refinadas e ajustes operacionais.
      </p>
    </section>
  );
}
