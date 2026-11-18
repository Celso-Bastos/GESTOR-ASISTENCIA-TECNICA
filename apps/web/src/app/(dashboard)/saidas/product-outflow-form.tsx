"use client";

import Link from "next/link";
import { PackagePlus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  getSuggestedUnitPrice,
  formatCurrencyBRL,
  parseCurrencyInput,
  productCategories,
  productCategoryLabels,
  type ProductCategory
} from "@/lib/products/format";
import {
  createProductOutflowAction,
  updateProductOutflowAction,
  type ProductOutflow,
  type CustomerOption,
  type ProductActionState,
  type ProductModelTemplate
} from "./actions";

type ProductOutflowFormProps = {
  templates: ProductModelTemplate[];
  customers: CustomerOption[];
  today: string;
  outflow?: ProductOutflow;
};

const initialState: ProductActionState = {};

export function ProductOutflowForm({
  templates,
  customers,
  today,
  outflow
}: ProductOutflowFormProps) {
  const [state, action, isPending] = useActionState(
    outflow ? updateProductOutflowAction.bind(null, outflow.id) : createProductOutflowAction,
    initialState
  );
  const [category, setCategory] = useState<ProductCategory>(
    (state.values?.category as ProductCategory) || outflow?.category || "screen_protector"
  );
  const [templateId, setTemplateId] = useState(
    String(state.values?.model_template_id ?? outflow?.model_template_id ?? "")
  );
  const [unitPrice, setUnitPrice] = useState(
    String(state.values?.unit_price ?? outflow?.unit_price ?? getSuggestedUnitPrice(category)).replace(".", ",")
  );
  const [customModelName, setCustomModelName] = useState(
    String(state.values?.custom_model_name ?? outflow?.custom_model_name ?? "")
  );
  const [quantity, setQuantity] = useState(String(outflow?.quantity ?? 1));
  const total = Number(quantity) * (parseCurrencyInput(unitPrice) ?? 0);
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.is_active || template.id === outflow?.model_template_id),
    [templates, outflow?.model_template_id]
  );

  function handleCategoryChange(value: ProductCategory) {
    setCategory(value);
    setTemplateId("");
    setUnitPrice(String(getSuggestedUnitPrice(value)).replace(".", ","));
  }

  function handleTemplateChange(value: string) {
    setTemplateId(value);

    const template = activeTemplates.find((item) => item.id === value);

    if (!template) {
      setUnitPrice(String(getSuggestedUnitPrice(category)).replace(".", ","));
      return;
    }

    setCategory(template.category);
    setCustomModelName("");
    setUnitPrice(String(getSuggestedUnitPrice(template.category, template)).replace(".", ","));
  }

  return (
    <form action={action} className="grid w-full max-w-3xl gap-5">
      <div className="grid gap-4 rounded-md border border-line bg-surface p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <label className="grid gap-2 text-sm font-medium text-body">
          Categoria/produto base
          <select
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            name="category"
            onChange={(event) =>
              handleCategoryChange(event.target.value as ProductCategory)
            }
            value={category}
          >
            {productCategories.map((item) => (
              <option key={item} value={item}>
                {productCategoryLabels[item]}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Usar produto na saida
          <select
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            name="model_template_id"
            onChange={(event) => handleTemplateChange(event.target.value)}
            value={templateId}
          >
            <option value="">Sem produto cadastrado</option>
            {activeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {productCategoryLabels[template.category]} - {template.model_name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-body sm:col-span-2">
          Modelo digitado
          <input
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            disabled={Boolean(templateId)}
            maxLength={120}
            name="custom_model_name"
            onChange={(event) => setCustomModelName(event.target.value)}
            placeholder="Ex.: iPhone 11, Turbo USB-C, Motorola Edge 40 Neo"
            value={customModelName}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Quantidade
          <input
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            min={1}
            name="quantity"
            required
            type="number"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Valor unitario
          <input
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            inputMode="decimal"
            name="unit_price"
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="25,00"
            required
            value={unitPrice}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Data da venda/saida
          <input
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            defaultValue={String(state.values?.sold_at ?? outflow?.sold_at ?? today)}
            name="sold_at"
            required
            type="date"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-body">
          Cliente opcional
          <select
            className="h-12 rounded-md border border-line-strong bg-surface px-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            defaultValue={String(state.values?.customer_id ?? outflow?.customer_id ?? "")}
            name="customer_id"
          >
            <option value="">Sem cliente vinculado</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium text-body sm:col-span-2">
          Observacao
          <textarea
            className="min-h-28 rounded-md border border-line-strong bg-surface px-3 py-3 text-base text-foreground outline-none transition focus:border-accent-border focus:ring-2 focus:ring-focus-soft sm:text-sm"
            defaultValue={String(state.values?.notes ?? outflow?.notes ?? "")}
            maxLength={1000}
            name="notes"
          />
        </label>

        <label className={outflow ? "hidden" : "flex gap-3 rounded-md border border-line bg-surface-muted p-4 text-sm leading-6 text-body sm:col-span-2"}>
          <input
            className="mt-1 size-5 shrink-0 rounded border-line-strong text-accent"
            disabled={Boolean(templateId) || Boolean(outflow)}
            name="save_as_template"
            type="checkbox"
          />
          <span>Salvar este modelo para usar depois</span>
        </label>
      </div>

      <p className="rounded-md bg-accent-soft p-4 text-lg font-semibold" aria-live="polite">Total: {Number.isFinite(total) ? formatCurrencyBRL(total) : "Revise quantidade e valor"}</p>
      {state.success ? <p role="status" className="rounded-md bg-accent-soft p-3">{state.success}</p> : null}
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-focus disabled:cursor-not-allowed disabled:bg-disabled-bg"
          disabled={isPending}
          type="submit"
        >
          <Save className="size-4" aria-hidden="true" />
          {isPending ? "Salvando..." : outflow ? "Salvar alterações" : "Registrar saida"}
        </button>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-line-strong bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
          href="/saidas"
        >
          Cancelar
        </Link>
        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface px-5 text-sm font-semibold text-body transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-focus"
          href="/saidas/modelos"
        >
          <PackagePlus className="size-4" aria-hidden="true" />
          Produtos cadastrados
        </Link>
      </div>
    </form>
  );
}
