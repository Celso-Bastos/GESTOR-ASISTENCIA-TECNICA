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
    <span className="inline-flex w-fit rounded-md border border-accent-line bg-accent-soft px-2 py-1 text-xs font-semibold text-accent">
      {formatProductCategoryLabel(category)}
    </span>
  );
}
