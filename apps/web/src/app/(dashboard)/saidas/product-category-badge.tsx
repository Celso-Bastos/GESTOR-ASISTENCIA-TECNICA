import {
  formatProductCategoryLabel,
  type ProductCategory
} from "@/lib/products/format";

export function ProductCategoryBadge({
  category
}: {
  category: ProductCategory;
}) {
  return (
    <span className="inline-flex w-fit rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
      {formatProductCategoryLabel(category)}
    </span>
  );
}
