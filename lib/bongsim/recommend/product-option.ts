function numField(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 권장판매가: after.recommended_krw(숫자) 우선, 없으면 before.recommended_krw.
 * 표시용 — supply_krw / consumer_krw 미사용.
 */
export function computeRecommendedPrice(price_block: ProductOption["price_block"]): number | null {
  const after = numField(price_block?.after?.recommended_krw);
  if (after != null) return after;
  return numField(price_block?.before?.recommended_krw);
}

/** API/클라이언트 공통 — `bongsim_product_option` 조회 결과 최소 필드 */
export interface ProductOption {
  option_api_id: string;
  plan_name: string;
  network_family: string;
  plan_type: string | null;
  days_raw: string;
  allowance_label: string;
  option_label: string;
  price_block: {
    before?: { recommended_krw?: unknown };
    after?: { recommended_krw?: unknown };
  };
  flags: Record<string, unknown>;
  /** API가 붙이는 권장가(표시 전용) */
  recommended_price?: number;
}

/** 천 단위 콤마 + "원~" */
export function formatKrw(n: number): string {
  return `${Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원~`;
}

/** 엑셀 용량(allowance_label) 기준: 정확히 무제한/완전 무제한/unlimited 만 진짜 무제한. 500MB·1GB 등은 저속 무제한(가짜). */
export function isTrueUnlimited(option: {
  allowance_label?: string | null;
  plan_type?: string | null;
}): boolean {
  const label = (option.allowance_label || "").trim();
  if (label === "무제한" || label === "완전 무제한" || label.toLowerCase() === "unlimited") return true;
  return false;
}

export function minRecommendedPrice(products: ProductOption[]): number | null {
  let min: number | null = null;
  for (const p of products) {
    const v =
      typeof p.recommended_price === "number" && Number.isFinite(p.recommended_price)
        ? p.recommended_price
        : computeRecommendedPrice(p.price_block);
    if (v == null) continue;
    if (min == null || v < min) min = v;
  }
  return min;
}

/** days_raw에서 첫 정수 추출 (없으면 null) */
export function extractDaysFromDaysRaw(daysRaw: string): number | null {
  const m = String(daysRaw).match(/(\d+)/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}
