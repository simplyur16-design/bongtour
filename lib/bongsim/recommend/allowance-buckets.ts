import type { ProductOption } from "@/lib/bongsim/recommend/product-option";
import { computeRecommendedPrice, isTrueUnlimited } from "@/lib/bongsim/recommend/product-option";

export type AllowanceBucketId =
  | "unlimited"
  | "500mb"
  | "1gb"
  | "2gb"
  | "3gb"
  | "4gb"
  | "5gb";

/** `bongsim_product_option` 일수 스텝 — 여정 일수를 API·플랜 카드에 맞출 때 사용 */
export const BONGSIM_PLAN_DAY_TIERS = [1, 2, 3, 4, 5, 10, 15, 30] as const;

/** `tripDays`보다 작지 않은 가장 작은 티어(상위 일수). 예: 13→15, 18→30, 31→30 */
export function matchBillableTripDays(tripDays: number): number {
  const d = Math.max(1, Math.floor(Number(tripDays)));
  for (const t of BONGSIM_PLAN_DAY_TIERS) {
    if (t >= d) return t;
  }
  return 30;
}

const ORDER: AllowanceBucketId[] = [
  "unlimited",
  "500mb",
  "1gb",
  "2gb",
  "3gb",
  "4gb",
  "5gb",
];

export function detectAllowanceBucket(p: ProductOption): AllowanceBucketId | null {
  const pt = (p.plan_type || "").trim().toLowerCase();
  const nf = (p.network_family || "").trim().toLowerCase();
  const label = (p.allowance_label || "").toLowerCase();
  const compact = label.replace(/\s/g, "");

  if (isTrueUnlimited(p)) return "unlimited";
  /** 무제한 시트이지만 용량이 500MB 등이면 저속 무제한 → 용량 버킷으로만 분류 */
  const canParseCapacity =
    pt === "daily" ||
    pt === "unlimited" ||
    (nf === "local" && pt === "");
  if (!canParseCapacity) return null;

  if (/500\s*mb|500mb|0\.5gb/i.test(compact)) return "500mb";
  if (/(?<!\d)5gb(?!\d)/i.test(compact)) return "5gb";
  if (/(?<!\d)4gb(?!\d)/i.test(compact)) return "4gb";
  if (/(?<!\d)3gb(?!\d)/i.test(compact)) return "3gb";
  if (/(?<!\d)2gb(?!\d)/i.test(compact)) return "2gb";
  if (/(?<!\d)1gb(?!\d)/i.test(compact)) return "1gb";

  if (/(\d+)\s*mb/i.test(label)) {
    const m = label.match(/(\d+)\s*mb/i);
    if (m && parseInt(m[1], 10) === 500) return "500mb";
  }

  return null;
}

function displayPrice(p: ProductOption): number | null {
  if (typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)) {
    return p.recommended_price;
  }
  return computeRecommendedPrice(p.price_block);
}

/** 버킷별 최저 권장가 상품 하나씩 (무제한은 권장가 없어도 첫 행 유지) */
export function pickCheapestPerBucket(products: ProductOption[]): Partial<
  Record<AllowanceBucketId, ProductOption>
> {
  const map: Partial<Record<AllowanceBucketId, ProductOption>> = {};
  for (const p of products) {
    const id = detectAllowanceBucket(p);
    if (!id) continue;
    const price = displayPrice(p);
    if (price == null && id !== "unlimited") continue;

    const cur = map[id];
    if (!cur) {
      map[id] = p;
      continue;
    }
    const curP = displayPrice(cur);
    if (price == null) continue;
    if (curP == null) {
      map[id] = p;
      continue;
    }
    if (price < curP) map[id] = p;
  }
  return map;
}

export function orderedBucketEntries(
  byBucket: Partial<Record<AllowanceBucketId, ProductOption>>,
): { id: AllowanceBucketId; product: ProductOption }[] {
  return ORDER.filter((id) => byBucket[id]).map((id) => ({
    id,
    product: byBucket[id]!,
  }));
}
