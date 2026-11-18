"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { normalizePhoneBR } from "@/lib/phone";
import {
  createQuickMaintenanceOrderAction,
  getQuickCustomerAddress,
  type QuickCustomerAddressResult,
  type MaintenanceActionState
} from "../actions";

const initialState: MaintenanceActionState = {};
const inputClass =
  "h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft";
const textareaClass =
  "min-h-32 rounded-md border border-line-strong bg-surface px-3 py-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft";

function valueFrom(state: MaintenanceActionState, key: string) {
  return state.values?.[key] ?? "";
}

export function QuickMaintenanceForm({ requestId }: { requestId: string }) {
  const [state, formAction, isPending] = useActionState(
    createQuickMaintenanceOrderAction,
    initialState
  );
  const [address, setAddress] = useState("");
  const [addressAction, setAddressAction] = useState<"preserve" | "set" | "clear">("preserve");
  const [customer, setCustomer] = useState<QuickCustomerAddressResult["customer"]>(null);
  const [addressFeedback, setAddressFeedback] = useState("");
  const lookupVersion = useRef(0);
  const lookupPhone = useRef("");
  const addressEdited = useRef(false);

  async function loadAddress(phone: string) {
    const normalized = normalizePhoneBR(phone);
    if (!/^\d{10,11}$/.test(normalized)) return;
    const version = ++lookupVersion.current;
    lookupPhone.current = normalized;
    setAddressFeedback("Consultando endereço...");
    try {
      const result = await getQuickCustomerAddress(phone);
      // Não usar respostas de outro telefone nem substituir texto já digitado.
      if (version !== lookupVersion.current) return;
      if (result.error) { setAddressFeedback(result.error); return; }
      const customerChanged = customer && customer.id !== result.customer?.id;
      if (customerChanged) addressEdited.current = false;
      setCustomer(result.customer);
      if (!addressEdited.current) {
        setAddress(result.customer?.address ?? "");
        setAddressAction("preserve");
      }
      setAddressFeedback(customerChanged ? "O cadastro deste telefone mudou. Confira o endereço antes de alterar." : (result.customer
        ? "Cliente encontrado. O endereço cadastrado será mantido se não for alterado."
        : "Nenhum cliente encontrado para este telefone. O endereço é opcional."));
    } catch {
      if (version !== lookupVersion.current) return;
      setAddressFeedback("Não foi possível consultar o endereço. Sem alteração, o cadastro será preservado.");
    }
  }

  return (
    <form action={formAction} aria-busy={isPending} className="grid w-full max-w-3xl gap-5">
      <input type="hidden" name="request_id" value={state.values?.request_id ?? requestId} />
      <input type="hidden" name="customer_address_action" value={addressAction} />
      <input type="hidden" name="customer_address_customer_id" value={customer?.id ?? ""} />
      <fieldset className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm sm:p-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Cliente
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-body">
            Nome do cliente (opcional)
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "customer_name")}
              name="customer_name"
              disabled={isPending}
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-body">
            Telefone/WhatsApp (opcional)
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "phone")}
              inputMode="tel"
              name="phone"
              type="tel"
              disabled={isPending}
              onBlur={(event) => void loadAddress(event.currentTarget.value)}
              onChange={(event) => {
                if (lookupPhone.current && lookupPhone.current !== normalizePhoneBR(event.target.value)) {
                  lookupVersion.current++;
                  lookupPhone.current = "";
                  addressEdited.current = false;
                  setCustomer(null);
                  setAddress("");
                  setAddressAction("preserve");
                  setAddressFeedback("");
                }
              }}
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-body">
          Endereço (opcional)
          <textarea className="min-h-24 rounded-md border border-line-strong bg-surface px-3 py-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft"
            name="customer_address" autoComplete="street-address" maxLength={300} rows={2}
            aria-describedby="quick-address-help" value={address} disabled={isPending}
            onChange={(event) => {
              addressEdited.current = true;
              setAddress(event.target.value);
              setAddressAction(event.target.value.trim() ? "set" : "preserve");
            }} />
        </label>
        <p id="quick-address-help" className="text-xs text-muted">Vazio preserva o endereço já cadastrado.</p>
        {customer ? <button type="button" disabled={isPending} aria-pressed={addressAction === "clear"}
          className="min-h-11 w-fit rounded-md px-3 text-sm font-medium text-danger transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:text-disabled"
          onClick={() => {
            const clear = addressAction !== "clear";
            addressEdited.current = clear;
            setAddress(clear ? "" : customer.address ?? "");
            setAddressAction(clear ? "clear" : "preserve");
          }}>
          {addressAction === "clear" ? "Manter endereço cadastrado" : "Remover endereço cadastrado"}
        </button> : null}
        {addressFeedback ? <p role="status" className="text-sm text-muted">{addressAction === "clear"
          ? "O endereço cadastrado será removido ao salvar a manutenção." : addressFeedback}</p> : null}
      </fieldset>

      <fieldset className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm sm:p-5">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Atendimento
        </legend>

        <label className="grid gap-2 text-sm font-medium text-body">
          Modelo do aparelho
          <input
            className={inputClass}
            defaultValue={valueFrom(state, "device_model")}
            name="device_model"
            required
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Defeito informado
          <textarea
            className={textareaClass}
            defaultValue={valueFrom(state, "reported_issue")}
            name="reported_issue"
            required
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium text-body">
            Previsão de entrega
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "expected_delivery_date")}
              name="expected_delivery_date"
              type="date"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-body">
            Valor estimado (opcional)
            <input
              className={inputClass}
              defaultValue={valueFrom(state, "estimated_price")}
              name="estimated_price"
              type="number"
              inputMode="decimal"
              min="0"
              max="99999999.99"
              step="0.01"
              placeholder="150,00"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium text-body">
          Observação rápida
          <textarea
            className={textareaClass}
            defaultValue={valueFrom(state, "quick_notes")}
            name="quick_notes"
          />
        </label>
      </fieldset>

      <p className="rounded-md border border-line bg-surface-muted px-4 py-3 text-sm leading-6 text-muted">
        Você pode abrir uma manutenção rápida mesmo sem os dados do cliente.
        Depois será possível completar as informações na edição da OS.
      </p>

      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button
          className="h-12 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Salvando..." : "Salvar manutenção"}
        </button>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
          href="/manutencoes/nova"
        >
          Usar cadastro completo
        </Link>
      </div>
    </form>
  );
}
