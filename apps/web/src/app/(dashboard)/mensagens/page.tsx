import {
  AVAILABLE_MESSAGE_VARIABLES,
  FUTURE_MESSAGE_TEMPLATES
} from "@/lib/messages/defaults";
import {
  getCustomMessageTemplates,
  getMessageTemplatesForCurrentOrganization
} from "./actions";
import { CustomMessageTemplateManager } from "./custom-message-template-manager";
import { MessageTemplateForm } from "./message-template-form";

export default async function MensagensPage() {
  const [templates, customTemplates] = await Promise.all([
    getMessageTemplatesForCurrentOrganization(),
    getCustomMessageTemplates()
  ]);

  return (
    <section className="grid gap-6">
      <div>
        <p className="text-sm font-medium uppercase text-accent">Fase 10</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">
          Mensagens
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Configure modelos operacionais e mensagens personalizadas para
          WhatsApp manual. O sistema monta a mensagem, registra o clique e abre
          o WhatsApp em nova aba; nenhum envio automatico e feito pelo MVP.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4">
          <section className="grid gap-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Modelos padrao do sistema
              </h2>
              <p className="mt-1 text-sm leading-6 text-muted">
                Modelos operacionais fixos da organizacao, usados nos botoes
                rapidos do detalhe da OS.
              </p>
            </div>

            {templates.map((template) => (
              <MessageTemplateForm key={template.type} template={template} />
            ))}
          </section>

          <CustomMessageTemplateManager templates={customTemplates} />
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-md border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              Variaveis disponiveis
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {AVAILABLE_MESSAGE_VARIABLES.map((variable) => (
                <code
                  className="rounded-md border border-line bg-surface-muted px-2 py-1 text-xs text-body"
                  key={variable}
                >
                  {"{{" + variable + "}}"}
                </code>
              ))}
            </div>
          </section>

          <section className="rounded-md border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              Manual por WhatsApp
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Mensagens de manutencao e entrega sao comunicacoes do servico.
              Mensagens promocionais futuras devem respeitar whatsapp_opt_in =
              true e ainda nao possuem envio em massa.
            </p>
          </section>

          <section className="rounded-md border border-line bg-surface p-4 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">
              Tipos futuros
            </h2>
            <div className="mt-3 grid gap-3">
              {FUTURE_MESSAGE_TEMPLATES.map((template) => (
                <div
                  className="rounded-md border border-dashed border-line-strong p-3"
                  key={template.type}
                >
                  <p className="text-sm font-semibold text-foreground">
                    {template.title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
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
