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
