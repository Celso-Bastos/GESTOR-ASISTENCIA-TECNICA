import {
  AVAILABLE_MESSAGE_VARIABLES,
  FUTURE_MESSAGE_TEMPLATES
} from "@/lib/messages/defaults";
import { getMessageTemplatesForCurrentOrganization } from "./actions";
import { MessageTemplateForm } from "./message-template-form";

export default async function MensagensPage() {
  const templates = await getMessageTemplatesForCurrentOrganization();

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-teal-700">Fase 7</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Mensagens
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Configure modelos operacionais para WhatsApp manual. O sistema monta a
          mensagem, registra o clique e abre o WhatsApp em uma nova aba; nenhum
          envio automatico e feito pelo MVP.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          {templates.map((template) => (
            <MessageTemplateForm key={template.type} template={template} />
          ))}
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Variaveis disponiveis
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {AVAILABLE_MESSAGE_VARIABLES.map((variable) => (
                <code
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700"
                  key={variable}
                >
                  {"{{" + variable + "}}"}
                </code>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Manual por WhatsApp
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Mensagens de manutencao e entrega sao comunicacoes do servico.
              Mensagens promocionais futuras devem respeitar whatsapp_opt_in =
              true e ainda nao possuem envio em massa.
            </p>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-slate-950">
              Tipos futuros
            </h2>
            <div className="mt-3 grid gap-3">
              {FUTURE_MESSAGE_TEMPLATES.map((template) => (
                <div
                  className="rounded-md border border-dashed border-slate-300 p-3"
                  key={template.type}
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {template.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {template.description}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
