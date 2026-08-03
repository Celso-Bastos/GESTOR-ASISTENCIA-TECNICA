"use client";

import { Eye, Filter, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import { interpolateMessageTemplate } from "@/lib/messages/interpolation";
import {
  customMessageContextLabels,
  customMessageContexts,
  type CustomMessageContext
} from "@/lib/validations/custom-message-template.schema";
import {
  createCustomMessageTemplateAction,
  disableCustomMessageTemplateAction,
  updateCustomMessageTemplateAction,
  type CustomMessageTemplate,
  type CustomMessageTemplateActionState
} from "./actions";

type CustomMessageTemplateManagerProps = {
  templates: CustomMessageTemplate[];
};

const initialState: CustomMessageTemplateActionState = {};
const previewVariables = {
  cliente_nome: "Cliente Exemplo",
  cliente_telefone: "(11) 99999-9999",
  aparelho_modelo: "Samsung A32",
  numero_ordem: "OS-000001",
  status: "Em manutencao",
  data_entrega: "31/12/2026",
  loja_nome: "Loja Exemplo",
  garantia_periodo: "90 dias",
  garantia_validade: "31/12/2026"
};

function StateMessage({ state }: { state: CustomMessageTemplateActionState }) {
  const message = state.error || state.success;

  if (!message) {
    return null;
  }

  return (
    <p
      className={
        state.error
          ? "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          : "rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      }
    >
      {message}
    </p>
  );
}

function ContextSelect({
  value,
  onChange
}: {
  value: CustomMessageContext;
  onChange: (value: CustomMessageContext) => void;
}) {
  return (
    <select
      className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
      name="context"
      onChange={(event) => onChange(event.target.value as CustomMessageContext)}
      value={value}
    >
      {customMessageContexts.map((context) => (
        <option key={context} value={context}>
          {customMessageContextLabels[context]}
        </option>
      ))}
    </select>
  );
}

function MessagePreview({ body }: { body: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-500">
        <Eye className="size-4" aria-hidden="true" />
        Previa
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
        {interpolateMessageTemplate(body, previewVariables)}
      </p>
    </div>
  );
}

function CreateCustomMessageTemplateForm() {
  const [state, action, isPending] = useActionState(
    createCustomMessageTemplateAction,
    initialState
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [context, setContext] = useState<CustomMessageContext>("maintenance");
  const [isActive, setIsActive] = useState(true);

  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-medium uppercase text-teal-700">
          Nova mensagem
        </p>
        <h3 className="mt-1 text-lg font-semibold text-slate-950">
          Mensagem personalizada
        </h3>
      </div>

      <form action={action} className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Titulo
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            maxLength={100}
            minLength={2}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Contexto
          <ContextSelect value={context} onChange={setContext} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Corpo da mensagem
          <textarea
            className="min-h-44 rounded-md border border-slate-300 bg-white px-3 py-3 text-base leading-6 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            maxLength={2000}
            name="body"
            onChange={(event) => setBody(event.target.value)}
            required
            value={body}
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700">
          <input
            checked={isActive}
            className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
            name="is_active"
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          Ativa
        </label>

        <MessagePreview body={body} />
        <StateMessage state={state} />

        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
          disabled={isPending}
          type="submit"
        >
          <Plus className="size-4" aria-hidden="true" />
          {isPending ? "Criando..." : "Criar mensagem"}
        </button>
      </form>
    </article>
  );
}

function CustomMessageTemplateCard({
  template
}: {
  template: CustomMessageTemplate;
}) {
  const [saveState, saveAction, isSaving] = useActionState(
    updateCustomMessageTemplateAction.bind(null, template.id),
    initialState
  );
  const [disableState, disableAction, isDisabling] = useActionState(
    disableCustomMessageTemplateAction.bind(null, template.id),
    initialState
  );
  const [title, setTitle] = useState(template.title);
  const [body, setBody] = useState(template.body);
  const [context, setContext] = useState<CustomMessageContext>(template.context);
  const [isActive, setIsActive] = useState(template.is_active);

  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase text-teal-700">
            {customMessageContextLabels[template.context]}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">
            {template.title}
          </h3>
        </div>
        <span
          className={
            template.is_active
              ? "inline-flex w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
              : "inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600"
          }
        >
          {template.is_active ? "Ativa" : "Inativa"}
        </span>
      </div>

      <form action={saveAction} className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Titulo
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            maxLength={100}
            minLength={2}
            name="title"
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Contexto
          <ContextSelect value={context} onChange={setContext} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Corpo da mensagem
          <textarea
            className="min-h-40 rounded-md border border-slate-300 bg-white px-3 py-3 text-base leading-6 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            maxLength={2000}
            name="body"
            onChange={(event) => setBody(event.target.value)}
            required
            value={body}
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700">
          <input
            checked={isActive}
            className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
            name="is_active"
            onChange={(event) => setIsActive(event.target.checked)}
            type="checkbox"
          />
          Ativa
        </label>

        <MessagePreview body={body} />
        <StateMessage state={saveState} />

        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
            disabled={isSaving}
            type="submit"
          >
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      <form action={disableAction} className="grid gap-2">
        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
          disabled={isDisabling}
          type="submit"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {isDisabling ? "Desativando..." : "Desativar"}
        </button>
        <StateMessage state={disableState} />
      </form>
    </article>
  );
}

export function CustomMessageTemplateManager({
  templates
}: CustomMessageTemplateManagerProps) {
  const [filter, setFilter] = useState<CustomMessageContext | "all">("all");
  const filteredTemplates = useMemo(() => {
    if (filter === "all") {
      return templates;
    }

    return templates.filter((template) => template.context === filter);
  }, [filter, templates]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Mensagens personalizadas
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Mensagens da organizacao atual, separadas dos modelos padrao do
            sistema.
          </p>
        </div>

        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:w-56">
          <span className="inline-flex items-center gap-2">
            <Filter className="size-4" aria-hidden="true" />
            Contexto
          </span>
          <select
            className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            onChange={(event) =>
              setFilter(event.target.value as CustomMessageContext | "all")
            }
            value={filter}
          >
            <option value="all">Todos</option>
            {customMessageContexts.map((context) => (
              <option key={context} value={context}>
                {customMessageContextLabels[context]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CreateCustomMessageTemplateForm />

      {filteredTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          Nenhuma mensagem personalizada encontrada.
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <CustomMessageTemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </section>
  );
}
