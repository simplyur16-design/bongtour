import { COUNTRY_OPTIONS } from "@/lib/bongsim/country-options";
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import { isRegionPackCode, planNameForRegionPackCode } from "@/lib/bongsim/recommend/region-pack-plan";

export type CoverageCountryRow = {
  code: string;
  nameKr: string;
};

/** 고객 안내용 유럽 포함 국가 — 33/36/42 패키지 구분 없이 동일 목록 */
export const EU_TRAVELER_COVERAGE_PLAN_NAME = "유럽 33개국";

/** 별도 ISO 코드 없이 인접국 현지망으로 이용되는 지역 */
export const EU_COVERAGE_FOOTNOTES = [
  "바티칸·산마리노는 이탈리아 현지망으로 이용됩니다.",
] as const;

const NAME_BY_CODE = new Map(COUNTRY_OPTIONS.map((c) => [c.code.toLowerCase(), c.nameKr]));

function resolveCoveragePlanName(input: {
  destinationCode?: string | null;
  planName?: string | null;
}): string {
  const code = (input.destinationCode ?? "").trim().toLowerCase();
  if (code.startsWith("rg-eu-")) return EU_TRAVELER_COVERAGE_PLAN_NAME;

  const fromCode = code && isRegionPackCode(code) ? planNameForRegionPackCode(code) : undefined;
  return (fromCode ?? input.planName ?? "").trim();
}

export function isEuropeRegionDestination(code: string | null | undefined): boolean {
  return (code ?? "").trim().toLowerCase().startsWith("rg-eu-");
}

/** `rg-eu-33` 또는 `유럽 33개국` 등 → 가나다순 한글 국가명 목록 */
export function listCoverageCountries(input: {
  destinationCode?: string | null;
  planName?: string | null;
}): CoverageCountryRow[] {
  const planName = resolveCoveragePlanName(input);
  if (!planName) return [];

  const codes = getPlanCoveredCountries(planName);
  const rows: CoverageCountryRow[] = [];
  for (const code of codes) {
    const lc = code.toLowerCase();
    const nameKr = NAME_BY_CODE.get(lc) ?? lc.toUpperCase();
    rows.push({ code: lc, nameKr });
  }
  rows.sort((a, b) => a.nameKr.localeCompare(b.nameKr, "ko"));
  return rows;
}

export function coveragePreviewLabel(countries: CoverageCountryRow[], previewCount = 5): string | null {
  if (countries.length === 0) return null;
  const head = countries.slice(0, previewCount).map((c) => c.nameKr);
  const rest = countries.length - head.length;
  if (rest <= 0) return head.join(", ");
  return `${head.join(", ")} 외 ${rest}개국`;
}
