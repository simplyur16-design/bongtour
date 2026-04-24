import { MULTI_COUNTRY_PLAN_COVERAGE } from "@/lib/bongsim/plan-coverage-map";

const BASE = new Set(["jp", "vn", "my", "ph", "mv"]);

/**
 * 로밍/로컬 선택 팝업이 필요한 국가 (일본, 베트남, 유럽33·36, 말레이시아, 필리핀, 몰디브).
 */
export function isCountryWithLocalNetworkChoice(code: string): boolean {
  const c = code.toLowerCase();
  if (BASE.has(c)) return true;
  const eu33 = MULTI_COUNTRY_PLAN_COVERAGE["유럽 33개국"] ?? [];
  const eu36 = MULTI_COUNTRY_PLAN_COVERAGE["유럽 36개국"] ?? [];
  return eu33.includes(c) || eu36.includes(c);
}
