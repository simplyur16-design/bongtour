function numField(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * 스토어프론트·추천 API 정렬용 표시 단가: after.consumer_krw → before.consumer_krw 만 (권장가·공급가 폴백 없음).
 * 함수명은 호환용으로 유지.
 */
export function computeRecommendedPrice(price_block: ProductOption["price_block"]): number | null {
  const after = numField(price_block?.after?.consumer_krw);
  if (after != null) return after;
  return numField(price_block?.before?.consumer_krw);
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
  /** DB `qos_raw` — plans API 등에서 노출 */
  qos_raw?: string | null;
  price_block: {
    before?: { recommended_krw?: unknown; consumer_krw?: unknown };
    after?: { recommended_krw?: unknown; consumer_krw?: unknown };
  };
  flags: Record<string, unknown>;
  /** API가 붙이는 표시 단가(소비자가 계열; 필드명은 호환용). */
  recommended_price?: number;
}

/** 천 단위 콤마 + "원" */
export function formatKrw(n: number): string {
  return `${Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원`;
}

/** 천 단위 콤마 + "원/일" (패키지 총액÷상품 `days_raw` 일당 등) */
export function formatKrwPerDay(n: number): string {
  return `${Number(n).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}원/일`;
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
