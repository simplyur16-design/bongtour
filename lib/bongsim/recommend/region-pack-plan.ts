/** 추천 퍼널 `rg-*` 코드 → DB/엑셀 `plan_name` (다국가 패키지) */
export const REGION_PACK_PLAN_NAME_BY_CODE: Record<string, string> = {
  "rg-eu-42": "유럽 42개국",
  "rg-us-ca": "미국/캐나다",
  "rg-sea-3": "동남아 3개국",
  "rg-global-151": "글로벌 151개국",
  "rg-eu-36": "유럽 36개국",
  "rg-eu-33": "유럽 33개국",
  "rg-eu-27": "유럽 27개국",
  "rg-es-pt": "스페인/포르투갈",
  "rg-au-nz": "호주/뉴질랜드",
  "rg-na-3": "미국/캐나다/멕시코",
  "rg-cn-hk-mo": "중국/홍콩/마카오",
  "rg-hk-mo": "홍콩/마카오",
  "rg-gu-mp": "괌/사이판",
  "rg-sea-8": "동남아 8개국",
  "rg-as-13": "아시아 13개국",
  "rg-nafr-4": "북아프리카 4개국(경유)",
  "rg-sa-11": "남미10개국",
};

export function planNameForRegionPackCode(code: string): string | undefined {
  return REGION_PACK_PLAN_NAME_BY_CODE[code.trim().toLowerCase()];
}

export function isRegionPackCode(code: string): boolean {
  return code.trim().toLowerCase().startsWith("rg-");
}

/** usimsa 다국가 탭 노출 순 (스크린샷 교차검증) */
export const USIMSA_MULTI_TAB_ORDER = [
  "rg-eu-42",
  "rg-eu-36",
  "rg-eu-33",
  "rg-eu-27",
  "rg-es-pt",
  "rg-us-ca",
  "rg-na-3",
  "rg-cn-hk-mo",
  "rg-hk-mo",
  "rg-sea-8",
  "rg-sea-3",
  "rg-as-13",
  "rg-au-nz",
  "rg-gu-mp",
  "rg-global-151",
  "rg-sa-11",
  "rg-nafr-4",
] as const;

/** 그리드 한 줄 라벨 — DB plan_name 우선 */
export function regionPackGridLabel(code: string, opt?: { nameKr: string; subtitleKr?: string }): string {
  const plan = planNameForRegionPackCode(code);
  if (plan) return plan;
  if (opt?.subtitleKr?.includes("개국")) return `${opt.nameKr} ${opt.subtitleKr}`;
  if (opt?.subtitleKr) return `${opt.nameKr}/${opt.subtitleKr}`;
  return opt?.nameKr ?? code;
}
