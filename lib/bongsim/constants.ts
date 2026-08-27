import type { EsimProductTypeOption, FunnelState } from "./types";

/**
 * 봉투어 통합 시 봉심 스토어프론트 URL prefix.
 * 봉심 원본은 `(store)` 라우트 그룹을 루트에 두었으나,
 * 봉투어로 이식하면서 `/travel/esim` 하위로 전부 이동.
 *
 * 내부 링크·리다이렉트는 반드시 `bongsimPath()`로 감쌀 것.
 */
export const BONGSIM_BASE_PATH = "/travel/esim" as const;

/** 봉투어 오픈카톡 — `lib/kakao-open-chat.ts` 와 동일 env */
export const BONGSIM_KAKAO_CHANNEL_URL = process.env.NEXT_PUBLIC_KAKAO_OPEN_CHAT_URL || ''

/** eSIM 결제·가이드·체크아웃 하단 — 1차 문의 안내 카피 */
export const BONGSIM_ESIM_USIM_SUPPORT_COPY =
  '봉투어 고객센터(09:00-18:00 KST)로 문의해 주세요. 시간 외 긴급 문의는 마이페이지 → eSIM 구매내역 → 고객지원센터를 이용해 주세요.'

/** eSIM 메인 랜딩 「24시간 안심 고객센터」 카드 부제 */
export const BONGSIM_ESIM_SUPPORT_CARD_BODY = 'Bong투어 카카오톡으로 문의하세요'

/** 결제·가이드·기기·체크아웃 등 1차 문의 */
export const BONGSIM_ESIM_SUPPORT_EMAIL_LINE = '고객지원 문의: bongtour24@naver.com'

/** 유심사 CX — eSIM 설치·사용 문의 카카오톡 1:1 채팅 (공식 채널) */
export const USIMSA_CX_KAKAO_CHAT_URL = 'https://pf.kakao.com/_fqTkK/chat'

/** 유심사 CX — 이메일·문의 채널 페이지 */
export const USIMSA_CX_CONTACT_URL = 'https://www.usimsa.com/board/contact-channel/'

/** 로밍 상품 중 구글맵·ChatGPT 데이터 무료 혜택 대상 plan_name 화이트리스트 */
export const ESIM_FREE_DATA_PLAN_NAMES = new Set<string>([
  "괌",
  "괌/사이판",
  "사이판",
  "뉴질랜드",
  "호주",
  "호주/뉴질랜드",
  "대한민국",
  "대한민국(3Mbps)",
  "일본",
  "베트남",
  "필리핀",
  "싱가포르",
  "태국",
  "중국",
  "말레이시아",
  "인도네시아",
  "캄보디아",
  "아시아 13개국",
  "남미 10개국",
  "캐나다",
  "미국/캐나다/멕시코",
  "이탈리아",
  "프랑스",
  "스페인",
  "터키(튀르키예)",
  "영국",
  "독일",
  "카타르",
  "포르투갈",
  "유럽 42개국",
  "유럽 33개국",
  "유럽 36개국",
  "미국/캐나다",
  "동남아 3개국",
  "동남아 8개국",
  "아시아 13개국",
  "호주/뉴질랜드",
  "아랍에미리트",
]);

export function esimHasFreeData(networkFamily?: string, planName?: string): boolean {
  return (
    (networkFamily ?? "").toLowerCase() === "roaming" &&
    !!planName &&
    ESIM_FREE_DATA_PLAN_NAMES.has(planName.trim())
  );
}

export function bongsimPath(sub: string = ""): string {
  if (!sub) return BONGSIM_BASE_PATH;
  const normalized = sub.startsWith("/") ? sub : `/${sub}`;
  return `${BONGSIM_BASE_PATH}${normalized}`;
}

/** 랜딩 국가 선택(어디로 떠나시나요?) — 예전 /recommend Step1 피커 대신 */
// REGRESSION-FREEZE[bongsim-esim-hero-country-picker-landing]: 히어로→랜딩 피커 — manifest
export const ESIM_COUNTRY_PICKER_HASH = "esim-countries";

export function bongsimCountryPickerHref(): string {
  return `${BONGSIM_BASE_PATH}#${ESIM_COUNTRY_PICKER_HASH}`;
}

export const FUNNEL_STORAGE_KEY = "bongsim:funnel:v1";

export const ORDERS_STORAGE_KEY = "bongsim:orders:v1";

/** 추천 퍼널 → 체크아웃: 국가별 `{ optionApiId, quantity }[]` (JSON, sessionStorage) */
export const BONGSIM_RECOMMEND_CHECKOUT_QUEUE_KEY = "bongsim:recommend_checkout_queue:v1";

/** eSIM 홈 「선물하기」 → 체크아웃에서 선물 모드 기본 켜기 */
export const BONGSIM_GIFT_CHECKOUT_FLAG_KEY = "bongsim:gift_checkout:v1";

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
