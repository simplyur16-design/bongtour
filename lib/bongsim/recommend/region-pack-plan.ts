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
  "rg-nafr-4": "북아프리카 4개국(경유팩)",
  "rg-sa-11": "남미 11개국",
  "rg-benelux-3": "베네룩스 3국",
  "rg-nordic-5": "북유럽 5개국",
  "rg-me-6": "중동 6개국",
  "rg-ca-5": "중앙아시아 5개국",
  "rg-caucasus-3": "코카서스 3국(경유팩)",
  "rg-kr-jp": "한국/일본",
  "rg-kr-cn-jp": "한국/중국/일본",
  "rg-fr-ch-it": "프랑스/스위스/이탈리아",
};

/** 동일 권역 탭이 커버하는 엑셀 plan_name 별칭 */
export const REGION_PACK_PLAN_NAME_ALIASES: Record<string, string[]> = {
  "rg-nafr-4": ["북아프리카 4개국(경유팩)", "북아프리카 4개국(경유)"],
  "rg-caucasus-3": ["코카서스 3국(경유팩)", "코카서스 3개국(경유팩)"],
  "rg-sa-11": ["남미 11개국", "남미10개국", "남미 10개국"],
};

export function planNamesForRegionPackCode(code: string): string[] {
  const lc = code.trim().toLowerCase();
  const aliases = REGION_PACK_PLAN_NAME_ALIASES[lc];
  if (aliases?.length) return [...aliases];
  const primary = REGION_PACK_PLAN_NAME_BY_CODE[lc];
  return primary ? [primary] : [];
}

export function planNameForRegionPackCode(code: string): string | undefined {
  return planNamesForRegionPackCode(code)[0];
}

export function isRegionPackCode(code: string): boolean {
  return code.trim().toLowerCase().startsWith("rg-");
}

/** usimsa 다국가 탭 노출 순 */
export const USIMSA_MULTI_TAB_ORDER = [
  "rg-eu-42",
  "rg-eu-36",
  "rg-eu-33",
  "rg-eu-27",
  "rg-es-pt",
  "rg-benelux-3",
  "rg-nordic-5",
  "rg-fr-ch-it",
  "rg-us-ca",
  "rg-na-3",
  "rg-cn-hk-mo",
  "rg-hk-mo",
  "rg-kr-jp",
  "rg-kr-cn-jp",
  "rg-sea-8",
  "rg-sea-3",
  "rg-as-13",
  "rg-me-6",
  "rg-ca-5",
  "rg-caucasus-3",
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
