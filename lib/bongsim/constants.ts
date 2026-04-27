import type { EsimProductTypeOption, FunnelState } from "./types";

/**
 * 봉투어 통합 시 봉심 스토어프론트 URL prefix.
 * 봉심 원본은 `(store)` 라우트 그룹을 루트에 두었으나,
 * 봉투어로 이식하면서 `/travel/esim` 하위로 전부 이동.
 *
 * 내부 링크·리다이렉트는 반드시 `bongsimPath()`로 감쌀 것.
 */
export const BONGSIM_BASE_PATH = "/travel/esim" as const;

export function bongsimPath(sub: string = ""): string {
  if (!sub) return BONGSIM_BASE_PATH;
  const normalized = sub.startsWith("/") ? sub : `/${sub}`;
  return `${BONGSIM_BASE_PATH}${normalized}`;
}

export const FUNNEL_STORAGE_KEY = "bongsim:funnel:v1";

export const ORDERS_STORAGE_KEY = "bongsim:orders:v1";

/** 추천 퍼널 → 체크아웃: 국가별 `{ optionApiId, quantity }[]` (JSON, sessionStorage) */
export const BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY = "bongsim:recommend_checkout_queue:v1";

export type BongsimRecommendCheckoutLine = { optionApiId: string; quantity: number };

export const EMPTY_FUNNEL: FunnelState = {
  countryIds: [],
  tripStart: null,
  tripEnd: null,
  tripDurationDays: null,
  tripDurationNights: null,
  network: null,
  planId: null,
  coverageProductId: null,
};

function parseYmd(s: string | null | undefined): Date | null {
  if (!s || typeof s !== "string") return null;
  const p = s.split("-").map((n) => Number(n));
  if (p.length !== 3 || p.some((n) => !Number.isFinite(n))) return null;
  const d = new Date(p[0]!, p[1]! - 1, p[2]!);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 출발·귀국일(YYYY-MM-DD)로 여행 일수(양 끝 포함). */
export function funnelTripDayCount(f: FunnelState): number {
  const s = parseYmd(f.tripStart);
  const e = parseYmd(f.tripEnd);
  if (!s || !e || e < s) return 0;
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

/** 숙박 기준 밤 수(0박 = 당일). tripStart·tripEnd 기준. */
export function funnelTripNights(f: FunnelState): number {
  const d = funnelTripDayCount(f);
  if (d < 1) return 0;
  return Math.max(0, d - 1);
}

/** tripStart·tripEnd로 일수·박 수를 맞춰 저장한다(단일 날짜 소스). */
export function withTripScheduleDerived(f: FunnelState): FunnelState {
  const d = funnelTripDayCount(f);
  if (!f.tripStart || !f.tripEnd || d < 1) {
    return { ...f, tripDurationDays: null, tripDurationNights: null };
  }
  return { ...f, tripDurationDays: d, tripDurationNights: Math.max(0, d - 1) };
}

export function isFunnelReadyForDatesStep(f: FunnelState): boolean {
  return f.countryIds.length >= 1;
}

export function isFunnelReadyForResult(f: FunnelState): boolean {
  return f.countryIds.length >= 1 && !!f.tripStart && !!f.tripEnd && funnelTripDayCount(f) >= 1;
}

/** 결제 직전까지 모두 확정(모의 결제용) */
export function isFunnelComplete(f: FunnelState): boolean {
  return isFunnelReadyForResult(f) && !!f.network && !!f.planId;
}

export function createDemoOrderId(): string {
  return `bs-${Date.now()}`;
}

/** roaming / local 각각 하나씩만 남긴다(같은 타입 중복으로 이중 선택 방지). */
export function distinctNetworkProductTypes(opts: EsimProductTypeOption[]): EsimProductTypeOption[] {
  const order: Array<"roaming" | "local"> = ["roaming", "local"];
  const m = new Map<"roaming" | "local", EsimProductTypeOption>();
  for (const o of opts) {
    if (o.networkType !== "roaming" && o.networkType !== "local") continue;
    if (!m.has(o.networkType)) m.set(o.networkType, o);
  }
  return order.filter((k) => m.has(k)).map((k) => m.get(k)!);
}

/** STEP 4: 팝업은 로밍형·현지망형이 데이터상 둘 다 있을 때만. */
export function hasRoamingAndLocalProductTypes(opts: EsimProductTypeOption[]): boolean {
  return sheetOptionsRoamingThenLocal(opts).length === 2;
}

/** 로밍 → 현지망 순. 타입이 둘 다 없으면 빈 배열 → 팝업 생략. */
export function sheetOptionsRoamingThenLocal(opts: EsimProductTypeOption[]): EsimProductTypeOption[] {
  const d = distinctNetworkProductTypes(opts);
  const roaming = d.find((o) => o.networkType === "roaming");
  const local = d.find((o) => o.networkType === "local");
  if (!roaming || !local) return [];
  return [
    {
      ...roaming,
      label: "로밍형",
      helperText: roaming.helperText ?? "여러 국가 이동에 유리한 방식이에요.",
    },
    {
      ...local,
      label: "현지망형",
      helperText: local.helperText ?? "현지 네트워크 중심으로 쓰는 방식이에요.",
    },
  ];
}
