import type { Pool } from "pg";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL } from "@/lib/bongsim/data/catalog-consumer-krw-sql";
import { parseFlagsJson } from "@/lib/bongsim/data/parse-product-json";
import { resolveDestinationPlanNamesForSql } from "@/lib/bongsim/data/single-destination-plan-names";
import {
  getKycLabelDistribution,
  getEffectiveKycLabelState,
  hasBinaryAuthDistribution,
  type KycLabelDistribution,
} from "@/lib/bongsim/esim/kyc-required";
import {
  detectAllowanceBucket,
  type AllowanceBucketId,
} from "@/lib/bongsim/recommend/allowance-buckets";
import { matchesBongsimPlanFilters } from "@/lib/bongsim/recommend/matches-plan-filters";
import {
  computeRecommendedPrice,
  extractDaysFromDaysRaw,
  isTrueUnlimited,
  type ProductOption,
} from "@/lib/bongsim/recommend/product-option";
import { resolveEffectivePlanType } from "@/lib/bongsim/recommend/resolve-effective-plan-type";
import {
  pickRecommendedBySpeedTier,
  type PlanRecSource,
} from "@/lib/bongsim/recommend/plan-speed-tier";

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: plans SQL slim + single-dest filter — manifest

type Row = {
  option_api_id: string;
  plan_name: string;
  network_family: string;
  plan_type: string | null;
  days_raw: string;
  allowance_label: string;
  option_label: string;
  price_block: Record<string, unknown>;
  flags: Record<string, unknown>;
  qos_raw: string | null;
};

type EnrichedPlan = ReturnType<typeof enrich>;

type RecSource = PlanRecSource;

export type RecommendedPlan = EnrichedPlan & { rec_source: RecSource };

export type RecommendedByAuth = {
  required: RecommendedPlan | null;
  not_required: RecommendedPlan | null;
};

export type PlanCatalogGroups = {
  unlimited: EnrichedPlan[];
  daily: EnrichedPlan[];
  fixed: EnrichedPlan[];
};

export type QueryPlanCatalogParams = {
  pool: Pool;
  country: string;
  days: number;
  allSelected: string[];
  network?: "roaming" | "local" | null;
  /** SQL WHERE fragment (no leading AND). Default: active eSIM-capable catalog. */
  catalogWhere?: string;
};

export type QueryPlanCatalogResult = {
  plans: EnrichedPlan[];
  recommended: RecommendedPlan | null;
  recommended_by_auth: RecommendedByAuth | null;
  kyc_distribution: KycLabelDistribution;
  groups: PlanCatalogGroups;
  trip_days: number;
  matched_days: number;
};

function enrich(row: Row) {
  const price_block = row.price_block as ProductOption["price_block"];
  const recommended_price = computeRecommendedPrice(price_block);
  const is_true_unlimited = isTrueUnlimited(row);
  const effectivePlanType = resolveEffectivePlanType(row);
  const plan_type = effectivePlanType ?? row.plan_type;
  return { ...row, plan_type, price_block, recommended_price, is_true_unlimited };
}

function isQos128kbpsRow(qos_raw: string | null): boolean {
  const s = (qos_raw || "").toLowerCase().replace(/\s+/g, "");
  if (!s) return false;
  if (/128kbps|128kb|128k\b/.test(s)) return true;
  if (/128/.test(s) && /kbps|kb\/s|kbit/.test(s)) return true;
  return false;
}

function isQos384kbpsRow(qos_raw: string | null): boolean {
  const s = (qos_raw || "").toLowerCase().replace(/\s+/g, "");
  if (!s) return false;
  if (/384kbps|384kb|384k\b/.test(s)) return true;
  if (/384/.test(s) && /kbps|kb\/s|kbit/.test(s)) return true;
  return false;
}

function passesShipmentAndQosFilter(row: Row, opts?: { skip128kbps?: boolean }): boolean {
  if (!opts?.skip128kbps && isQos128kbpsRow(row.qos_raw)) return false;
  const { request_shipment } = parseFlagsJson(row.flags);
  if (request_shipment.trim().toUpperCase() !== "O") return false;
  return true;
}

function parseMbpsFromQos(qos_raw: string | null): number | null {
  const low = (qos_raw || "").trim().toLowerCase();
  if (!low) return null;
  const kb = low.match(/(\d+(?:\.\d+)?)\s*kbps/);
  if (kb) {
    const n = parseFloat(kb[1]);
    return Number.isFinite(n) ? n / 1000 : null;
  }
  const mb = low.match(/(\d+(?:\.\d+)?)\s*mbps/);
  if (mb) {
    const n = parseFloat(mb[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isTrueUnlimited1MbpsPlus(p: EnrichedPlan): boolean {
  if (!p.is_true_unlimited) return false;
  const m = parseMbpsFromQos(p.qos_raw);
  return m != null && m >= 1;
}

function apply384RedundantFilter(plans: EnrichedPlan[]): EnrichedPlan[] {
  return plans.filter((p) => {
    if (!isQos384kbpsRow(p.qos_raw)) return true;
    const d = extractDaysFromDaysRaw(p.days_raw);
    const price = p.recommended_price;
    if (d == null || price == null) return true;
    const hasSamePricedUnlimited = plans.some(
      (q) =>
        q.option_api_id !== p.option_api_id &&
        isTrueUnlimited1MbpsPlus(q) &&
        extractDaysFromDaysRaw(q.days_raw) === d &&
        q.recommended_price === price,
    );
    return !hasSamePricedUnlimited;
  });
}

function applyLocalRoamingPriceFilter(plans: EnrichedPlan[]): EnrichedPlan[] {
  const nf = (p: EnrichedPlan) => (p.network_family || "").trim().toLowerCase();
  type GKey = string;
  const groups = new Map<GKey, EnrichedPlan[]>();
  for (const p of plans) {
    const days = extractDaysFromDaysRaw(p.days_raw);
    const bucket = detectAllowanceBucket(p as ProductOption);
    if (days == null || bucket == null) continue;
    const k = `${days}:${bucket}`;
    const arr = groups.get(k) ?? [];
    arr.push(p);
    groups.set(k, arr);
  }
  const exclude = new Set<string>();
  for (const arr of groups.values()) {
    const roaming = arr.filter((x) => nf(x) === "roaming");
    if (roaming.length === 0) continue;
    let minRoaming = Number.POSITIVE_INFINITY;
    for (const r of roaming) {
      const pr = r.recommended_price;
      if (pr != null && Number.isFinite(pr) && pr < minRoaming) minRoaming = pr;
    }
    if (!Number.isFinite(minRoaming)) continue;
    for (const l of arr) {
      if (nf(l) !== "local") continue;
      const lp = l.recommended_price;
      if (lp == null) continue;
      if (lp > minRoaming) exclude.add(l.option_api_id);
    }
  }
  return plans.filter((p) => !exclude.has(p.option_api_id));
}

function applyTierInputFilters(plans: EnrichedPlan[]): EnrichedPlan[] {
  return applyLocalRoamingPriceFilter(apply384RedundantFilter(plans));
}

const CAPACITY_RANK: AllowanceBucketId[] = ["500mb", "1gb", "2gb", "3gb", "4gb", "5gb"];

function capacityRank(bucket: AllowanceBucketId | null): number {
  if (!bucket || bucket === "unlimited") return -1;
  const i = CAPACITY_RANK.indexOf(bucket);
  return i >= 0 ? i : 999;
}

function comparePriceAsc(a: EnrichedPlan, b: EnrichedPlan): number {
  const pa = a.recommended_price ?? Number.POSITIVE_INFINITY;
  const pb = b.recommended_price ?? Number.POSITIVE_INFINITY;
  return pa - pb;
}

function isQos5MbpsForPremium(qos_raw: string | null): boolean {
  const s = (qos_raw || "").trim().toLowerCase();
  if (!s) return false;
  return /(?<![0-9.])5\s*mbps\b/.test(s);
}

function sortUnlimitedGroup(plans: EnrichedPlan[]): EnrichedPlan[] {
  const five = plans.filter((p) => isQos5MbpsForPremium(p.qos_raw)).sort(comparePriceAsc);
  const rest = plans.filter((p) => !isQos5MbpsForPremium(p.qos_raw)).sort(comparePriceAsc);
  return [...five, ...rest];
}

function sortByAllowanceAsc(plans: EnrichedPlan[]): EnrichedPlan[] {
  return [...plans].sort((a, b) => {
    const ra = capacityRank(detectAllowanceBucket(a as ProductOption));
    const rb = capacityRank(detectAllowanceBucket(b as ProductOption));
    if (ra !== rb) return ra - rb;
    return comparePriceAsc(a, b);
  });
}

function normalizeAllowanceKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "");
}

function allowanceLabelSortKey(label: string): number {
  const compact = label.trim().toLowerCase().replace(/\s/g, "");
  const gb = compact.match(/(\d+(?:\.\d+)?)gb/);
  if (gb) return parseFloat(gb[1]) * 1024;
  const mb = compact.match(/(\d+(?:\.\d+)?)mb/);
  if (mb) return parseFloat(mb[1]);
  return 99999;
}

function dedupeMinDaysAtOrAbove(
  plans: EnrichedPlan[],
  tripDays: number,
  groupKey: (p: EnrichedPlan) => string | null,
): EnrichedPlan[] {
  const best = new Map<string, EnrichedPlan>();
  for (const p of plans) {
    const key = groupKey(p);
    if (!key) continue;
    const d = extractDaysFromDaysRaw(p.days_raw);
    if (d == null || d < tripDays) continue;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, p);
      continue;
    }
    const prevD = extractDaysFromDaysRaw(prev.days_raw);
    if (prevD == null || d < prevD) best.set(key, p);
  }
  return [...best.values()];
}

function kycDedupeKeySuffix(p: EnrichedPlan): string {
  const state = getEffectiveKycLabelState(p);
  if (state === "required") return ":kyc:O";
  if (state === "not_required") return ":kyc:X";
  return ":kyc:unknown";
}

function fixedGroupKey(p: EnrichedPlan): string | null {
  const key = normalizeAllowanceKey(p.allowance_label || "");
  return key ? `${key}${kycDedupeKeySuffix(p)}` : null;
}

function dailyGroupKey(p: EnrichedPlan): string | null {
  const bucket = detectAllowanceBucket(p as ProductOption);
  const base =
    bucket && bucket !== "unlimited" ? bucket : normalizeAllowanceKey(p.allowance_label || "");
  return base ? `${base}${kycDedupeKeySuffix(p)}` : null;
}

function unlimitedGroupKey(p: EnrichedPlan): string | null {
  const qos = (p.qos_raw || "").trim().toLowerCase().replace(/\s+/g, "");
  const base = qos ? `unlimited:${qos}` : "unlimited:unknown";
  return `${base}${kycDedupeKeySuffix(p)}`;
}

function computeMatchedBillableDays(plans: EnrichedPlan[], tripDays: number): number {
  let min: number | null = null;
  for (const p of plans) {
    const d = extractDaysFromDaysRaw(p.days_raw);
    if (d == null || d < tripDays) continue;
    if (min == null || d < min) min = d;
  }
  return min ?? tripDays;
}

function sortFixedByAllowanceAsc(plans: EnrichedPlan[]): EnrichedPlan[] {
  return [...plans].sort((a, b) => {
    const ka = allowanceLabelSortKey(a.allowance_label || "");
    const kb = allowanceLabelSortKey(b.allowance_label || "");
    if (ka !== kb) return ka - kb;
    return comparePriceAsc(a, b);
  });
}

export function buildPlanGroups(pool: EnrichedPlan[], tripDays: number): PlanCatalogGroups {
  const unlimited: EnrichedPlan[] = [];
  const daily: EnrichedPlan[] = [];
  const fixed: EnrichedPlan[] = [];
  for (const p of pool) {
    const pt = (p.plan_type || "").trim().toLowerCase();
    if (pt === "unlimited") unlimited.push(p);
    else if (pt === "daily") daily.push(p);
    else if (pt === "fixed") fixed.push(p);
  }
  return {
    unlimited: sortUnlimitedGroup(dedupeMinDaysAtOrAbove(unlimited, tripDays, unlimitedGroupKey)),
    daily: sortByAllowanceAsc(dedupeMinDaysAtOrAbove(daily, tripDays, dailyGroupKey)),
    fixed: sortFixedByAllowanceAsc(dedupeMinDaysAtOrAbove(fixed, tripDays, fixedGroupKey)),
  };
}

function groupCandidates(pool: EnrichedPlan[], tripDays: number): ProductOption[] {
  const groups = buildPlanGroups(pool, tripDays);
  return [...groups.unlimited, ...groups.daily, ...groups.fixed] as ProductOption[];
}

function filterPoolByExactCatalogDays(pool: EnrichedPlan[], catalogDays: number): EnrichedPlan[] {
  return pool.filter((p) => extractDaysFromDaysRaw(p.days_raw) === catalogDays);
}

function pickRecommendedFromPool(pool: EnrichedPlan[], tripDays: number): RecommendedPlan | null {
  if (pool.length === 0) return null;

  let maxCatalogDays = tripDays;
  for (const p of pool) {
    const d = extractDaysFromDaysRaw(p.days_raw);
    if (d != null && d > maxCatalogDays) maxCatalogDays = d;
  }

  for (let catalogDays = tripDays; catalogDays <= maxCatalogDays; catalogDays++) {
    const dayPool = filterPoolByExactCatalogDays(pool, catalogDays);
    if (dayPool.length === 0) continue;
    const pick = pickRecommendedBySpeedTier(groupCandidates(dayPool, tripDays));
    if (!pick) return null;
    return { ...(pick as unknown as EnrichedPlan), rec_source: pick.rec_source };
  }

  return null;
}

function buildRecommendedByAuth(pool: EnrichedPlan[], tripDays: number): RecommendedByAuth {
  const requiredPool = pool.filter((p) => getEffectiveKycLabelState(p) === "required");
  const notRequiredPool = pool.filter((p) => getEffectiveKycLabelState(p) === "not_required");
  return {
    required: pickRecommendedFromPool(requiredPool, tripDays),
    not_required: pickRecommendedFromPool(notRequiredPool, tripDays),
  };
}

/** REGRESSION-FREEZE[bongsim-offline-usim-plan-picker]: plans API·오프라인 USIM 피커 공통 카탈로그 SSOT — manifest */
export async function queryPlanCatalog(params: QueryPlanCatalogParams): Promise<QueryPlanCatalogResult> {
  const catalogWhere = params.catalogWhere ?? BONGSIM_CATALOG_ACTIVE_WHERE;
  const networkParam: string | null = params.network ?? null;
  const days = params.days;
  const country = params.country.trim().toLowerCase();
  const allSelected = [...new Set(params.allSelected.map((c) => c.trim().toLowerCase()).filter(Boolean))];

  const singleDestPlanNames =
    allSelected.length === 1 ? resolveDestinationPlanNamesForSql(allSelected[0]!) : null;
  const planNameFilter = singleDestPlanNames && singleDestPlanNames.length > 0 ? singleDestPlanNames : null;

  // Prefer plain pool.query — BEGIN/SET LOCAL under txn pooler + pool starvation → ~8s query failed.
  // Destination plan_name filter keeps the scan narrow without holding a checkout client.
  const result = await params.pool.query(
    `
      SELECT
        option_api_id,
        plan_name,
        network_family,
        plan_type,
        days_raw,
        allowance_label,
        option_label,
        ${BONGSIM_CATALOG_SLIM_PRICE_BLOCK_SQL} AS price_block,
        flags,
        qos_raw
      FROM bongsim_product_option
      WHERE ${catalogWhere}
        AND ($1::text IS NULL OR lower(network_family) = lower($1::text))
        AND ($2::text[] IS NULL OR plan_name = ANY($2::text[]))
        AND (
          (plan_type IS NOT NULL AND lower(plan_type) IN ('unlimited', 'daily', 'fixed'))
          OR (
            plan_type IS NULL
            AND lower(network_family) = 'local'
            AND ($1::text IS NULL OR lower($1::text) = 'local')
          )
        )
      ORDER BY plan_name, days_raw
      `,
    [networkParam, planNameFilter],
  );

  const ctx = { country, days, allSelected };
  const matched = (result.rows as Row[]).filter((row) => matchesBongsimPlanFilters(row, ctx));
  const kycDistribution: KycLabelDistribution = getKycLabelDistribution(matched);
  const skip128kbps = hasBinaryAuthDistribution(matched);

  const shipmentFiltered = matched.filter((row) => passesShipmentAndQosFilter(row, { skip128kbps }));

  const enriched = shipmentFiltered.map(enrich).sort(comparePriceAsc);

  const tierPool = applyTierInputFilters(enriched);
  const groups = buildPlanGroups(tierPool, days);
  const isBinary = kycDistribution === "binary";
  const recommended = isBinary ? null : pickRecommendedFromPool(tierPool, days);
  const recommended_by_auth = isBinary ? buildRecommendedByAuth(tierPool, days) : null;
  const matched_days = computeMatchedBillableDays(enriched, days);

  return {
    plans: enriched,
    recommended,
    recommended_by_auth,
    kyc_distribution: kycDistribution,
    groups,
    trip_days: days,
    matched_days,
  };
}
