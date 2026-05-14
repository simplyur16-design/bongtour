import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import { computeRecommendedPrice } from "@/lib/bongsim/recommend/product-option";
import { isParsedAllowanceMb, parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import { extractPlanFeatures, scorePlan } from "@/lib/bongsim/recommend/score-plan";
import { isUnlimitedPlan } from "@/lib/bongsim/recommend/parse-speed";

type OptionWithActive = BongsimProductOptionV1 & { is_active?: boolean };

function consumerKrwForScore(option: BongsimProductOptionV1): number {
  return computeRecommendedPrice(option.price_block) ?? 0;
}

function coveredLen(option: BongsimProductOptionV1): number {
  return getPlanCoveredCountries(option.plan_name).length;
}

/** 티어 1~4: score 내림차순 → 커버 국가 수 오름차순 → 소비자가 오름차순 */
function bestMultiTier(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => {
    const sa = scorePlan(extractPlanFeatures(a), consumerKrwForScore(a));
    const sb = scorePlan(extractPlanFeatures(b), consumerKrwForScore(b));
    if (sb !== sa) return sb - sa;
    const la = coveredLen(a);
    const lb = coveredLen(b);
    if (la !== lb) return la - lb;
    const pa = consumerKrwForScore(a);
    const pb = consumerKrwForScore(b);
    if (pa !== pb) return pa - pb;
    return a.option_api_id.localeCompare(b.option_api_id);
  })[0] ?? null;
}

function normSelectedCountryCodes(codes: string[]): string[] {
  return codes
    .map((c) => {
      const x = c.trim().toLowerCase();
      return x === "uk" ? "gb" : x;
    })
    .filter(Boolean);
}

function filterMultiEligible(
  selectedNorm: string[],
  candidates: BongsimProductOptionV1[],
): BongsimProductOptionV1[] {
  return candidates.filter((o) => {
    const row = o as OptionWithActive;
    if (row.is_active === false) return false;
    const covered = getPlanCoveredCountries(o.plan_name).map((c) => c.toLowerCase());
    if (covered.length < 2) return false;
    return selectedNorm.every((code) => covered.includes(code));
  });
}

function pickRecommendedMulti(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  const f = (o: BongsimProductOptionV1) => extractPlanFeatures(o);
  const ul = (o: BongsimProductOptionV1) => isUnlimitedPlan(o.allowance_label, o.plan_type, o.plan_line_excel);

  let hit = bestMultiTier(
    pool.filter((o) => {
      const x = f(o);
      return ul(o) && x.generation === "g5" && x.isLocal && x.qosKbps != null && x.qosKbps >= 1000;
    }),
  );
  if (hit) return hit;

  hit = bestMultiTier(
    pool.filter((o) => {
      const x = f(o);
      return ul(o) && x.generation === "g5" && !x.isLocal && x.qosKbps != null && x.qosKbps >= 5000;
    }),
  );
  if (hit) return hit;

  hit = bestMultiTier(
    pool.filter((o) => {
      const x = f(o);
      return ul(o) && (x.generation === "g5" || x.generation === "g4_lte") && x.isLocal;
    }),
  );
  if (hit) return hit;

  hit = bestMultiTier(
    pool.filter((o) => {
      const x = f(o);
      return ul(o) && (x.qosKbps === null || x.qosKbps >= 1000);
    }),
  );
  if (hit) return hit;

  return bestRank5DailyMb(pool);
}

/** 5순위: 데일리 + 용량(mb) — mb 큰 순, 동률 시 score, 그다음 커버 수·가격 */
function bestRank5DailyMb(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  const rows = pool
    .map((o) => ({
      o,
      p: parseAllowance(o.allowance_label),
      pt: String(o.plan_type ?? "")
        .trim()
        .toLowerCase(),
    }))
    .filter(
      (
        x,
      ): x is { o: BongsimProductOptionV1; p: { kind: "mb"; mb: number }; pt: string } =>
        x.pt === "daily" && isParsedAllowanceMb(x.p),
    );
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    if (b.p.mb !== a.p.mb) return b.p.mb - a.p.mb;
    const sa = scorePlan(extractPlanFeatures(a.o), consumerKrwForScore(a.o));
    const sb = scorePlan(extractPlanFeatures(b.o), consumerKrwForScore(b.o));
    if (sb !== sa) return sb - sa;
    const la = coveredLen(a.o);
    const lb = coveredLen(b.o);
    if (la !== lb) return la - lb;
    return consumerKrwForScore(a.o) - consumerKrwForScore(b.o);
  });
  return rows[0]!.o;
}

export type MultiCountrySelection = {
  recommended: BongsimProductOptionV1 | null;
  coveredCountryCodes: string[];
  consumerKrw: number | null;
  totalEligibleCount: number;
  noEligible: boolean;
};

export function selectMultiCountryRecommendation(
  selectedCountryCodes: string[],
  candidates: BongsimProductOptionV1[],
): MultiCountrySelection {
  const selectedNorm = normSelectedCountryCodes(selectedCountryCodes);

  if (selectedNorm.length < 2 || candidates.length === 0) {
    return {
      recommended: null,
      coveredCountryCodes: [],
      consumerKrw: null,
      totalEligibleCount: 0,
      noEligible: true,
    };
  }

  const eligible = filterMultiEligible(selectedNorm, candidates);
  const totalEligibleCount = eligible.length;
  if (totalEligibleCount === 0) {
    return {
      recommended: null,
      coveredCountryCodes: [],
      consumerKrw: null,
      totalEligibleCount: 0,
      noEligible: true,
    };
  }

  const recommended = pickRecommendedMulti(eligible);
  if (!recommended) {
    return {
      recommended: null,
      coveredCountryCodes: [],
      consumerKrw: null,
      totalEligibleCount,
      noEligible: false,
    };
  }

  const coveredCountryCodes = getPlanCoveredCountries(recommended.plan_name).map((c) => c.toLowerCase());
  const consumerKrw = computeRecommendedPrice(recommended.price_block);

  return {
    recommended,
    coveredCountryCodes,
    consumerKrw,
    totalEligibleCount,
    noEligible: false,
  };
}
