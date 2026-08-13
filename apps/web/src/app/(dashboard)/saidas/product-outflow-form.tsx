"use client";

import Link from "next/link";
import { PackagePlus, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  getSuggestedUnitPrice,
  productCategories,
  productCategoryLabels,
  type ProductCategory
} from "@/lib/products/format";
import {
  createProductOutflowAction,
  type CustomerOption,
  type ProductActionState,
  type ProductModelTemplate
} from "./actions";

type ProductOutflowFormProps = {
  templates: ProductModelTemplate[];
  customers: CustomerOption[];
  today: string;
};

const initialState: ProductActionState = {};

export function ProductOutflowForm({
  templates,
  customers,
  today
}: ProductOutflowFormProps) {
  const [state, action, isPending] = useActionState(
    createProductOutflowAction,
    initialState
  );
  const [category, setCategory] = useState<ProductCategory>(
    (state.values?.category as ProductCategory) || "screen_protector"
  );
  const [templateId, setTemplateId] = useState(
    String(state.values?.model_template_id ?? "")
  );
  const [unitPrice, setUnitPrice] = useState(
    String(state.values?.unit_price ?? getSuggestedUnitPrice(category))
  );
  const [customModelName, setCustomModelName] = useState(
    String(state.values?.custom_model_name ?? "")
  );
  const activeTemplates = useMemo(
    () => templates.filter((template) => template.is_active),
    [templates]
  );

  function handleCategoryChange(value: ProductCategory) {
    setCategory(value);
    setTemplateId("");
    setUnitPrice(String(getSuggestedUnitPrice(value)));
  }

  function handleTemplateChange(value: string) {
    setTemplateId(value);

    const template = activeTemplates.find((item) => item.id === value);

    if (!template) {
      setUnitPrice(String(getSuggestedUnitPrice(category)));
      return;
    }

    setCategory(template.category);
    setCustomModelName("");
    setUnitPrice(String(getSuggestedUnitPrice(template.category, template)));
  }

  return (
    <form action={action} className="grid w-full max-w-3xl gap-5">
      <div className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 sm:p-5">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Categoria/produto base
          <select
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
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

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Usar produto na saida
          <select
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
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

        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          Modelo digitado
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            disabled={Boolean(templateId)}
            maxLength={120}
            name="custom_model_name"
            onChange={(event) => setCustomModelName(event.target.value)}
            placeholder="Ex.: iPhone 11, Turbo USB-C, Motorola Edge 40 Neo"
            value={customModelName}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Quantidade
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={String(state.values?.quantity ?? "1")}
            min={1}
            name="quantity"
            required
            type="number"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Valor unitario
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            inputMode="decimal"
            name="unit_price"
            onChange={(event) => setUnitPrice(event.target.value)}
            placeholder="25,00"
            required
            value={unitPrice}
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Data da venda/saida
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={String(state.values?.sold_at ?? today)}
            name="sold_at"
            required
            type="date"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Cliente opcional
          <select
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={String(state.values?.customer_id ?? "")}
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

        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          Observacao
          <textarea
            className="min-h-28 rounded-md border border-slate-300 bg-white px-3 py-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={String(state.values?.notes ?? "")}
            maxLength={1000}
            name="notes"
          />
        </label>

        <label className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700 sm:col-span-2">
          <input
            className="mt-1 size-5 shrink-0 rounded border-slate-300 text-teal-700"
            disabled={Boolean(templateId)}
            name="save_as_template"
            type="checkbox"
          />
          <span>Salvar este modelo para usar depois</span>
        </label>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <button
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-teal-700 px-5 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400"
          disabled={isPending}
          type="submit"
        >
          <Save className="size-4" aria-hidden="true" />
          {isPending ? "Salvando..." : "Registrar saida"}
        </button>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
          href="/saidas"
        >
          Cancelar
        </Link>
        <Link
          className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200"
          href="/saidas/modelos"
        >
          <PackagePlus className="size-4" aria-hidden="true" />
          Produtos cadastrados
        </Link>
      </div>
    </form>
  );
}
