import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { computeRecommendedPrice } from "@/lib/bongsim/recommend/product-option";
import { allowanceTierBucket, isParsedAllowanceMb, parseAllowance } from "@/lib/bongsim/recommend/parse-allowance";
import type { NetworkGeneration } from "@/lib/bongsim/recommend/parse-speed";
import { extractPlanFeatures, scorePlan } from "@/lib/bongsim/recommend/score-plan";

type OptionWithActive = BongsimProductOptionV1 & { is_active?: boolean };

function consumerKrw(option: BongsimProductOptionV1): number {
  return computeRecommendedPrice(option.price_block) ?? 0;
}

const GEN_ORDER: NetworkGeneration[] = ["g5", "g4_lte", "g4", "g3", "mixed", "unknown"];

function genRank(g: NetworkGeneration): number {
  const i = GEN_ORDER.indexOf(g);
  return i === -1 ? 99 : i;
}

/** gentle 슬롯: 세대 우선(낮은 rank 먼저), 동일 시 소비자가 오름차순 */
function sortGentlePreferred(a: BongsimProductOptionV1, b: BongsimProductOptionV1): number {
  const ga = genRank(extractPlanFeatures(a).generation);
  const gb = genRank(extractPlanFeatures(b).generation);
  if (ga !== gb) return ga - gb;
  return consumerKrw(a) - consumerKrw(b);
}

function bestByScoreDescending(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => {
    const sa = scorePlan(extractPlanFeatures(a), consumerKrw(a));
    const sb = scorePlan(extractPlanFeatures(b), consumerKrw(b));
    if (sb !== sa) return sb - sa;
    return a.option_api_id.localeCompare(b.option_api_id);
  });
  return sorted[0] ?? null;
}

function preFilterCandidates(candidates: BongsimProductOptionV1[]): BongsimProductOptionV1[] {
  return candidates.filter((o) => {
    const row = o as OptionWithActive;
    if (row.is_active === false) return false;
    const pa = parseAllowance(o.allowance_label);
    if (pa.kind === "unknown" && o.plan_type !== "unlimited") return false;
    return true;
  });
}

function pickRecommended(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  const f = (o: BongsimProductOptionV1) => extractPlanFeatures(o);

  let hit = bestByScoreDescending(
    pool.filter((o) => {
      const x = f(o);
      return x.isUnlimited && x.generation === "g5" && x.isLocal && x.qosKbps != null && x.qosKbps >= 1000;
    }),
  );
  if (hit) return hit;

  hit = bestByScoreDescending(
    pool.filter((o) => {
      const x = f(o);
      return x.isUnlimited && x.generation === "g5" && !x.isLocal && x.qosKbps != null && x.qosKbps >= 5000;
    }),
  );
  if (hit) return hit;

  hit = bestByScoreDescending(
    pool.filter((o) => {
      const x = f(o);
      return x.isUnlimited && (x.generation === "g5" || x.generation === "g4_lte") && x.isLocal;
    }),
  );
  if (hit) return hit;

  hit = bestByScoreDescending(
    pool.filter((o) => {
      const x = f(o);
      return x.isUnlimited && (x.qosKbps === null || x.qosKbps >= 1000);
    }),
  );
  if (hit) return hit;

  const dailyLarge = pool.filter((o) => {
    const pt = String(o.plan_type ?? "")
      .trim()
      .toLowerCase();
    if (pt !== "daily") return false;
    return allowanceTierBucket(parseAllowance(o.allowance_label)) === "large";
  });
  return bestByScoreDescending(dailyLarge);
}

function pickSmallestMbLarge(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  const rows = pool
    .map((o) => ({ o, p: parseAllowance(o.allowance_label) }))
    .filter(
      (r): r is { o: BongsimProductOptionV1; p: { kind: "mb"; mb: number } } =>
        allowanceTierBucket(r.p) === "large" && isParsedAllowanceMb(r.p),
    );
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    if (a.p.mb !== b.p.mb) return a.p.mb - b.p.mb;
    return sortGentlePreferred(a.o, b.o);
  });
  return rows[0]!.o;
}

function pickGentle1(pool: BongsimProductOptionV1[]): BongsimProductOptionV1 | null {
  const medium = pool.filter((o) => allowanceTierBucket(parseAllowance(o.allowance_label)) === "medium");
  if (medium.length > 0) {
    const sorted = [...medium].sort(sortGentlePreferred);
    return sorted[0] ?? null;
  }
  return pickSmallestMbLarge(pool);
}

function pickGentle2(pool: BongsimProductOptionV1[], gentle1: BongsimProductOptionV1 | null): BongsimProductOptionV1 | null {
  const small = pool.filter((o) => allowanceTierBucket(parseAllowance(o.allowance_label)) === "small");
  if (small.length > 0) {
    const sorted = [...small].sort(sortGentlePreferred);
    return sorted[0] ?? null;
  }

  const mediumRows = pool
    .map((o) => ({ o, p: parseAllowance(o.allowance_label) }))
    .filter(
      (r): r is { o: BongsimProductOptionV1; p: { kind: "mb"; mb: number } } =>
        allowanceTierBucket(r.p) === "medium" && isParsedAllowanceMb(r.p),
    )
    .filter((r) => !gentle1 || r.o.option_api_id !== gentle1.option_api_id)
    .sort((a, b) => {
      if (a.p.mb !== b.p.mb) return a.p.mb - b.p.mb;
      return sortGentlePreferred(a.o, b.o);
    });
  return mediumRows[0]?.o ?? null;
}

export type SingleCountrySelection = {
  recommended: BongsimProductOptionV1 | null;
  gentle1: BongsimProductOptionV1 | null;
  gentle2: BongsimProductOptionV1 | null;
  totalCandidates: number;
};

export function selectSingleCountryRecommendation(candidates: BongsimProductOptionV1[]): SingleCountrySelection {
  const totalCandidates = candidates.length;
  const pool = preFilterCandidates(candidates);

  let recommended = pickRecommended(pool);
  let gentle1 = pickGentle1(pool);
  let gentle2 = pickGentle2(pool, gentle1);

  if (recommended && gentle1 && gentle1.option_api_id === recommended.option_api_id) {
    gentle1 = null;
  }
  if (recommended && gentle2 && gentle2.option_api_id === recommended.option_api_id) {
    gentle2 = null;
  }
  if (gentle1 && gentle2 && gentle2.option_api_id === gentle1.option_api_id) {
    gentle2 = null;
  }

  return { recommended, gentle1, gentle2, totalCandidates };
}
