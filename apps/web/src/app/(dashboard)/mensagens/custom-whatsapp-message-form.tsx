"use client";

import { MessageCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useActionState } from "react";
import { interpolateMessageTemplate } from "@/lib/messages/interpolation";
import {
  customMessageContextLabels,
  type CustomMessageContext
} from "@/lib/validations/custom-message-template.schema";
import {
  useCustomMessageTemplateAction,
  type CustomMessageTemplate,
  type WhatsAppMessageActionState
} from "./actions";

type CustomWhatsAppMessageFormProps = {
  orderId: string;
  templates: CustomMessageTemplate[];
  disabled?: boolean;
};

const initialState: WhatsAppMessageActionState = {};
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

export function CustomWhatsAppMessageForm({
  orderId,
  templates,
  disabled = false
}: CustomWhatsAppMessageFormProps) {
  const [state, action, isPending] = useActionState(
    useCustomMessageTemplateAction.bind(null, orderId),
    initialState
  );
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? "");
  const openedUrlRef = useRef<string | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [selectedId, templates]
  );

  useEffect(() => {
    if (state.whatsappUrl && openedUrlRef.current !== state.whatsappUrl) {
      openedUrlRef.current = state.whatsappUrl;
      window.open(state.whatsappUrl, "_blank", "noopener,noreferrer");
    }
  }, [state.whatsappUrl]);

  if (templates.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-600">
        Nenhuma mensagem personalizada ativa para manutencao.
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-3 rounded-md border border-slate-200 p-3">
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        Enviar mensagem personalizada
        <select
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
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
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Previa
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {interpolateMessageTemplate(selectedTemplate.body, previewVariables)}
          </p>
        </div>
      ) : null}

      <button
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
        disabled={disabled || isPending || !selectedTemplate}
        type="submit"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {isPending ? "Abrindo..." : "Abrir WhatsApp"}
      </button>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
