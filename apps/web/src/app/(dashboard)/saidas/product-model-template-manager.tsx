"use client";

import { Archive, Plus, Save, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useActionState } from "react";
import {
  getProductCategoryBasePrice,
  productCategories,
  productCategoryLabels,
  type ProductCategory
} from "@/lib/products/format";
import {
  createProductModelTemplateAction,
  deleteProductModelTemplateAction,
  disableProductModelTemplateAction,
  updateProductModelTemplateAction,
  type ProductActionState,
  type ProductModelTemplate
} from "./actions";
import { MoneyDisplay } from "./money-display";
import { ProductCategoryBadge } from "./product-category-badge";

type ProductModelTemplateManagerProps = {
  templates: ProductModelTemplate[];
};

const initialState: ProductActionState = {};

function StateMessage({ state }: { state: ProductActionState }) {
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

function CategorySelect({
  name = "category",
  onChange,
  value
}: {
  name?: string;
  onChange: (value: ProductCategory) => void;
  value: ProductCategory;
}) {
  return (
    <select
      className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
      name={name}
      onChange={(event) => onChange(event.target.value as ProductCategory)}
      value={value}
    >
      {productCategories.map((category) => (
        <option key={category} value={category}>
          {productCategoryLabels[category]}
        </option>
      ))}
    </select>
  );
}

function CategoryBasePriceText({ category }: { category: ProductCategory }) {
  const basePrice = getProductCategoryBasePrice(category);

  return (
    <p className="text-xs font-medium text-slate-500">
      Valor base da categoria:{" "}
      {basePrice === null ? (
        "sem valor definido"
      ) : (
        <MoneyDisplay value={basePrice} />
      )}
    </p>
  );
}

function CreateTemplateForm() {
  const [state, action, isPending] = useActionState(
    createProductModelTemplateAction,
    initialState
  );
  const [category, setCategory] = useState<ProductCategory>(
    (state.values?.category as ProductCategory) ?? "screen_protector"
  );

  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <p className="text-xs font-medium uppercase text-teal-700">
          Novo produto
        </p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Produto cadastrado
        </h2>
      </div>

      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Categoria
          <CategorySelect onChange={setCategory} value={category} />
          <CategoryBasePriceText category={category} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Valor do modelo (opcional)
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={String(state.values?.default_price ?? "")}
            inputMode="decimal"
            name="default_price"
            placeholder="25,00"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          Nome/modelo
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={String(state.values?.model_name ?? "")}
            maxLength={120}
            name="model_name"
            required
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700 sm:col-span-2">
          <input
            className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
            defaultChecked={
              typeof state.values?.is_active === "boolean"
                ? Boolean(state.values.is_active)
                : true
            }
            name="is_active"
            type="checkbox"
          />
          Ativo
        </label>

        <div className="grid gap-3 sm:col-span-2">
          <StateMessage state={state} />
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
            disabled={isPending}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            {isPending ? "Criando..." : "Criar produto"}
          </button>
        </div>
      </form>
    </article>
  );
}

function TemplateCard({ template }: { template: ProductModelTemplate }) {
  const [category, setCategory] = useState<ProductCategory>(template.category);
  const [saveState, saveAction, isSaving] = useActionState(
    updateProductModelTemplateAction.bind(null, template.id),
    initialState
  );
  const [disableState, disableAction, isDisabling] = useActionState(
    disableProductModelTemplateAction.bind(null, template.id),
    initialState
  );
  const [deleteState, deleteAction, isDeleting] = useActionState(
    deleteProductModelTemplateAction.bind(null, template.id),
    initialState
  );

  return (
    <article className="grid gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <ProductCategoryBadge category={template.category} />
          <h3 className="mt-2 break-words text-lg font-semibold text-slate-950">
            {template.model_name}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Valor do modelo: <MoneyDisplay value={template.default_price} />
          </p>
          <CategoryBasePriceText category={template.category} />
        </div>
        <span
          className={
            template.is_active
              ? "inline-flex w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
              : "inline-flex w-fit rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-600"
          }
        >
          {template.is_active ? "Ativo" : "Inativo"}
        </span>
      </div>

      <form action={saveAction} className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Categoria
          <CategorySelect onChange={setCategory} value={category} />
          <CategoryBasePriceText category={category} />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          Valor do modelo (opcional)
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={template.default_price ?? ""}
            inputMode="decimal"
            name="default_price"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700 sm:col-span-2">
          Nome/modelo
          <input
            className="h-12 rounded-md border border-slate-300 bg-white px-3 text-base text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100 sm:text-sm"
            defaultValue={template.model_name}
            maxLength={120}
            name="model_name"
            required
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700 sm:col-span-2">
          <input
            className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-200"
            defaultChecked={template.is_active}
            name="is_active"
            type="checkbox"
          />
          Ativo
        </label>

        <div className="grid gap-3 sm:col-span-2">
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
        </div>
      </form>

      <div className="flex flex-wrap gap-2">
        <form action={disableAction}>
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
            disabled={isDisabling || !template.is_active}
            type="submit"
          >
            <Archive className="size-4" aria-hidden="true" />
            {isDisabling ? "Desativando..." : "Desativar"}
          </button>
        </form>
        <form
          action={deleteAction}
          onSubmit={(event) => {
            if (!confirm("Excluir este modelo? Essa acao sera um soft delete.")) {
              event.preventDefault();
            }
          }}
        >
          <button
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:w-auto"
            disabled={isDeleting}
            type="submit"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {isDeleting ? "Excluindo..." : "Excluir"}
          </button>
        </form>
      </div>
      <StateMessage state={disableState} />
      <StateMessage state={deleteState} />
    </article>
  );
}

export function ProductModelTemplateManager({
  templates
}: ProductModelTemplateManagerProps) {
  const [filter, setFilter] = useState<ProductCategory | "all">("all");
  const [search, setSearch] = useState("");
  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return templates.filter((template) => {
      const matchesCategory = filter === "all" || template.category === filter;
      const matchesSearch =
        !normalizedSearch ||
        template.model_name.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });
  }, [filter, search, templates]);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Produtos cadastrados
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Ative, desative e ajuste os produtos usados no formulario de saida.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(14rem,1fr)_14rem]">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Buscar por nome
            <span className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ex.: iPhone 11"
                value={search}
              />
            </span>
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            Categoria
            <select
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
              onChange={(event) =>
                setFilter(event.target.value as ProductCategory | "all")
              }
              value={filter}
            >
              <option value="all">Todas</option>
              {productCategories.map((category) => (
                <option key={category} value={category}>
                  {productCategoryLabels[category]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <CreateTemplateForm />

      {filteredTemplates.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">
          Nenhum modelo encontrado.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </section>
  );
}
