import type { SimplyurKoreaPack } from "@/lib/simplyur/catalog/load-korea-catalog";
import type { SimplyurPublicProduct } from "@/lib/simplyur/public-product";

export function productDays(product: Pick<SimplyurPublicProduct, "days" | "days_label">): number | null {
  if (typeof product.days === "number" && Number.isFinite(product.days)) return product.days;
  const m = product.days_label.match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

export function collectAvailableDays(pack: SimplyurKoreaPack): number[] {
  const all = [...pack.roaming.products, ...(pack.local?.products ?? [])];
  const set = new Set<number>();
  for (const p of all) {
    const d = productDays(p);
    if (d != null) set.add(d);
  }
  return [...set].sort((a, b) => a - b);
}

export function filterProductsByDays(products: SimplyurPublicProduct[], days: number): SimplyurPublicProduct[] {
  return products.filter((p) => productDays(p) === days);
}

export function minFormattedPrice(products: SimplyurPublicProduct[]): string | null {
  let best: SimplyurPublicProduct | null = null;
  for (const p of products) {
    const amt = p.simplyur_display?.amount;
    if (amt == null) continue;
    if (!best || (best.simplyur_display?.amount ?? Number.POSITIVE_INFINITY) > amt) best = p;
  }
  return best?.simplyur_display?.formatted ?? null;
}

export function formatPlanMessage(template: string, days: number): string {
  return template.replace(/\{N\}/g, String(days));
}
