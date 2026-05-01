import { MULTI_COUNTRY_PLAN_COVERAGE } from "@/lib/bongsim/plan-coverage-map";

/** 유럽 다국가 제안에 쓰는 국가 코드 (ISO 3166-1 alpha-2, 소문자) */
export const EUROPE_SELECTION_CODES = new Set([
  "gb",
  "fr",
  "de",
  "es",
  "it",
  "pt",
  "dk",
  "se",
  "at",
  "ie",
  "nl",
  "no",
  "gr",
  "ch",
  "fi",
  "be",
  "pl",
  "cz",
  "hu",
  "hr",
  "ro",
  "bg",
  "sk",
  "si",
  "lt",
  "lv",
  "ee",
  "lu",
  "mt",
  "cy",
  "is",
]);

/** 동남아 다국가 제안에 쓰는 국가 코드 */
export const SEA_SELECTION_CODES = new Set(["th", "vn", "sg", "my", "ph", "id", "kh", "la", "mm"]);

function normCodes(selected: string[]): string[] {
  return selected.map((c) => (c.trim().toLowerCase() === "uk" ? "gb" : c.trim().toLowerCase())).filter(Boolean);
}

type PlanCoverageKey = keyof typeof MULTI_COUNTRY_PLAN_COVERAGE;

function selectedSubsetOfPlanCoverage(selected: string[], planNameKey: PlanCoverageKey): boolean {
  const cov = MULTI_COUNTRY_PLAN_COVERAGE[planNameKey];
  if (!cov?.length) return false;
  const set = new Set(cov.map((x) => x.toLowerCase()));
  return selected.every((c) => set.has(c));
}

/**
 * 2개 이상 국가 선택 시 `bongsim_product_option.plan_name` 후보 (우선순위 순).
 * - 미국+캐나다(그리고 선택 전부가 해당 플랜 커버 내): `미국/캐나다`
 * - 유럽 국가 2개 이상이며 전부 유럽 42 커버: `유럽 33개국`(가능 시)·`유럽 42개국`
 * - 동남아 국가 2개 이상이며 전부 동남아 8 커버: `동남아 3개국`(가능 시)·`동남아 8개국`
 * - 그 외: 전부를 커버하는 글로벌 계열 플랜명 후보만
 */
export function suggestMultiPlanNamesForSelection(selectedCodes: string[]): string[] {
  const sel = normCodes(selectedCodes);
  if (sel.length < 2) return [];

  const euN = sel.filter((c) => EUROPE_SELECTION_CODES.has(c)).length;
  const seaN = sel.filter((c) => SEA_SELECTION_CODES.has(c)).length;
  const hasUs = sel.includes("us");
  const hasCa = sel.includes("ca");

  if (hasUs && hasCa && selectedSubsetOfPlanCoverage(sel, "미국/캐나다")) {
    return ["미국/캐나다"];
  }

  if (euN >= 2 && selectedSubsetOfPlanCoverage(sel, "유럽 42개국")) {
    const out: string[] = [];
    if (selectedSubsetOfPlanCoverage(sel, "유럽 33개국")) out.push("유럽 33개국");
    out.push("유럽 42개국");
    return out;
  }

  if (seaN >= 2 && selectedSubsetOfPlanCoverage(sel, "동남아 8개국")) {
    const out: string[] = [];
    if (selectedSubsetOfPlanCoverage(sel, "동남아 3개국")) out.push("동남아 3개국");
    out.push("동남아 8개국");
    return out;
  }

  const globalCandidates = ["글로벌 151개국", "BIZ 글로벌 151개국", "글로벌 109개국"] as const;
  return globalCandidates.filter((k) => selectedSubsetOfPlanCoverage(sel, k));
}

export function planNameMatchesSuggestion(planName: string, hints: string[]): boolean {
  const t = planName.trim();
  const compact = t.replace(/\s+/g, "");
  for (const h of hints) {
    const hc = h.replace(/\s+/g, "");
    if (t === h || compact === hc) return true;
  }
  return false;
}
