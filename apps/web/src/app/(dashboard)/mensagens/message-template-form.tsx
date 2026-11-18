"use client";

import { RotateCcw, Save } from "lucide-react";
import { useActionState } from "react";
import type { OperationalMessageType } from "@assistencia/shared/constants/message-types";
import { interpolateMessageTemplate } from "@/lib/messages/interpolation";
import type { MessageTemplate } from "@/lib/messages/defaults";
import {
  restoreDefaultMessageTemplateAction,
  updateMessageTemplateAction,
  type MessageTemplateActionState
} from "./actions";

type MessageTemplateFormProps = {
  template: MessageTemplate;
};

const initialState: MessageTemplateActionState = {};
const previewVariables = {
  cliente_nome: "Ana Souza",
  cliente_telefone: "(11) 99999-9999",
  aparelho_modelo: "iPhone 12",
  numero_ordem: "OS-000123",
  status: "Pronto para entrega",
  data_entrega: "12/07/2026",
  loja_nome: "Assistencia Tecnica"
};

export function MessageTemplateForm({ template }: MessageTemplateFormProps) {
  const [saveState, saveAction, isSaving] = useActionState(
    updateMessageTemplateAction.bind(
      null,
      template.type as OperationalMessageType
    ),
    initialState
  );
  const [restoreState, restoreAction, isRestoring] = useActionState(
    restoreDefaultMessageTemplateAction.bind(
      null,
      template.type as OperationalMessageType
    ),
    initialState
  );
  const message = saveState.error || saveState.success || restoreState.error || restoreState.success;
  const isError = !!saveState.error || !!restoreState.error;
  const preview = interpolateMessageTemplate(template.body, previewVariables);

  return (
    <article className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-medium uppercase text-accent">
          {template.type}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">
          {template.title}
        </h2>
      </div>

      <form action={saveAction} className="grid gap-3">
        <label className="grid gap-2 text-sm font-medium text-body">
          Titulo
          <input
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            defaultValue={template.title}
            name="title"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Mensagem
          <textarea
            className="min-h-40 rounded-md border border-line-strong bg-surface px-3 py-3 text-base leading-6 text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            defaultValue={template.body}
            maxLength={1200}
            name="body"
            required
          />
        </label>

        <div className="rounded-md border border-line bg-surface-muted p-3">
          <p className="text-xs font-semibold uppercase text-subtle">
            Previa
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">
            {preview}
          </p>
        </div>

        {message ? (
          <p
            role={isError ? "alert" : "status"}
            className={
              isError
                ? "rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger"
                : "rounded-md border border-success-line bg-success-soft px-3 py-2 text-sm text-success"
            }
          >
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg sm:w-auto"
            disabled={isSaving}
            type="submit"
          >
            <Save className="size-4" aria-hidden="true" />
            {isSaving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>

      <form action={restoreAction}>
        <button
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-4 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-canvas disabled:text-disabled sm:w-auto"
          disabled={isRestoring}
          type="submit"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {isRestoring ? "Restaurando..." : "Restaurar padrao"}
        </button>
      </form>
    </article>
  );
}
