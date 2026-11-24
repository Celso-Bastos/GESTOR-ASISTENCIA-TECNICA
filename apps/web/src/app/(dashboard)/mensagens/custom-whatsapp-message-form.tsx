"use client";

import { MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useWhatsAppAction, WhatsAppAlternatives } from "./whatsapp-controls";
import type { MessageVariables } from "@/lib/messages/interpolation";
import { interpolateMessageTemplate } from "@/lib/messages/interpolation";
import {
  customMessageContextLabels,
  type CustomMessageContext
} from "@/lib/messages/custom-template";
import { useCustomMessageTemplateAction } from "@/lib/messages/maintenance-actions";
import type { MaintenanceMessageTemplate } from "@/lib/messages/custom-template";

type CustomWhatsAppMessageFormProps = {
  orderId: string;
  templates: MaintenanceMessageTemplate[];
  disabled?: boolean;
  previewVariables: MessageVariables;
};

export function CustomWhatsAppMessageForm({
  orderId,
  templates,
  disabled = false,
  previewVariables
}: CustomWhatsAppMessageFormProps) {
  const { state, formAction, isPending, prepare, feedback } = useWhatsAppAction(
    useCustomMessageTemplateAction.bind(null, orderId)
  );
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates]
  );

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line-strong p-3 text-sm text-muted">
        Nenhuma mensagem personalizada ativa para manutencao.
      </div>
    );
  }

  return (
    <form action={formAction} onSubmit={prepare} className="grid gap-3 rounded-md border border-line p-3">
      <label className="grid gap-2 text-sm font-medium text-body">
        Enviar mensagem personalizada
        <select
          className="h-11 rounded-md border border-line-strong bg-surface px-3 text-sm text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
          disabled={disabled || isPending}
          name="template_id"
          onChange={(event) => setSelectedId(event.target.value)}
          value={selectedId}
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.title} -{" "}
              {customMessageContextLabels[
                template.context as CustomMessageContext
              ]}
            </option>
          ))}
        </select>
      </label>

      {selectedTemplate ? (
        <div className="rounded-md border border-line bg-surface-muted p-3">
          <p className="text-xs font-semibold uppercase text-subtle">
            Previa
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-body">
            {interpolateMessageTemplate(selectedTemplate.body, previewVariables)}
          </p>
        </div>
      ) : null}

      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-success-line disabled:cursor-not-allowed disabled:bg-disabled-bg sm:w-auto"
        disabled={disabled || isPending || !selectedTemplate}
        type="submit"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {isPending ? "Abrindo..." : "Abrir WhatsApp"}
      </button>

      <WhatsAppAlternatives state={state} feedback={feedback} />
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-xs leading-5 text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
