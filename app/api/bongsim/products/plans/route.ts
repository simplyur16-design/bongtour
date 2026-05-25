import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseFlagsJson } from "@/lib/bongsim/data/parse-product-json";
import { doesPlanCoverAllSelected, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import {
  detectAllowanceBucket,
  type AllowanceBucketId,
} from "@/lib/bongsim/recommend/allowance-buckets";
import {
  extractDaysFromDaysRaw,
  isTrueUnlimited,
} from "@/lib/bongsim/recommend/product-option";
import type { ProductOption } from "@/lib/bongsim/recommend/product-option";

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

type RecSource = "unlimited" | "daily" | "fixed";

type RecommendedPlan = EnrichedPlan & { rec_source: RecSource };

function numField(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && v.trim().toLowerCase() !== "null") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** plans API 전용: after.consumer_krw 만 (before 폴백 없음) */
function plansConsumerKrw(price_block: ProductOption["price_block"]): number | null {
  return numField(price_block?.after?.consumer_krw);
}

function enrich(row: Row) {
  const price_block = row.price_block as ProductOption["price_block"];
  const recommended_price = plansConsumerKrw(price_block);
  const is_true_unlimited = isTrueUnlimited(row);
  return { ...row, price_block, recommended_price, is_true_unlimited };
}

/** 128kbps 등 저속 전용 상품 제외 */
function isQos128kbpsRow(qos_raw: string | null): boolean {
  const s = (qos_raw || "").toLowerCase().replace(/\s+/g, "");
  if (!s) return false;
  if (/128kbps|128kb|128k\b/.test(s)) return true;
  if (/128/.test(s) && /kbps|kb\/s|kbit/.test(s)) return true;
  return false;
}

/** 384kbps 스로틀 표기 상품 */
function isQos384kbpsRow(qos_raw: string | null): boolean {
  const s = (qos_raw || "").toLowerCase().replace(/\s+/g, "");
  if (!s) return false;
  if (/384kbps|384kb|384k\b/.test(s)) return true;
  if (/384/.test(s) && /kbps|kb\/s|kbit/.test(s)) return true;
  return false;
}

function passesShipmentAndQosFilter(row: Row): boolean {
  if (isQos128kbpsRow(row.qos_raw)) return false;
  const { request_shipment } = parseFlagsJson(row.flags);
  if (request_shipment.trim().toUpperCase() !== "O") return false;
  return true;
}

/** Mbps 단위 숫자 (kbps는 Mbps로 환산). 파싱 불가면 null */
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

/** 정렬·비교용: Mbps 환산값, 없으면 -1 (낮은 QOS로 취급) */
function qosSortScoreMbps(qos_raw: string | null): number {
  const m = parseMbpsFromQos(qos_raw);
  return m != null && Number.isFinite(m) ? m : -1;
}

/** 프리미엄: 완전 무제한 + 5Mbps (15Mbps 등과 구분) */
function isQos5MbpsForPremium(qos_raw: string | null): boolean {
  const s = (qos_raw || "").trim().toLowerCase();
  if (!s) return false;
  return /(?<![0-9.])5\s*mbps\b/.test(s);
}

/** 진짜 무제한 + 최소 1Mbps */
function isTrueUnlimited1MbpsPlus(p: EnrichedPlan): boolean {
  if (!p.is_true_unlimited) return false;
  const m = parseMbpsFromQos(p.qos_raw);
  return m != null && m >= 1;
}

/**
 * 384kbps 상품: 같은 일수·같은 소비자가의 무제한(1Mbps 이상)이 있으면 제외.
 */
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

/**
 * 같은 일수·같은 용량 버킷에서 로컬이 로밍 최저가보다 비싸면 로컬 제외.
 */
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

/** unlimited: 5Mbps 묶음 먼저 → 그 외, 각 묶음 내 recommended_price 오름차순 */
function sortUnlimitedGroup(plans: EnrichedPlan[]): EnrichedPlan[] {
  const five = plans.filter((p) => isQos5MbpsForPremium(p.qos_raw)).sort(comparePriceAsc);
  const rest = plans.filter((p) => !isQos5MbpsForPremium(p.qos_raw)).sort(comparePriceAsc);
  return [...five, ...rest];
}

/** daily: allowance(용량) 오름차순, 동일 시 가격 오름차순 */
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

/** 종량제 정렬용 — allowance_label 에서 MB/GB 숫자 추출 */
function allowanceLabelSortKey(label: string): number {
  const compact = label.trim().toLowerCase().replace(/\s/g, "");
  const gb = compact.match(/(\d+(?:\.\d+)?)gb/);
  if (gb) return parseFloat(gb[1]) * 1024;
  const mb = compact.match(/(\d+(?:\.\d+)?)mb/);
  if (mb) return parseFloat(mb[1]);
  return 99999;
}

/**
 * tripDays 이상 valid_days 중 그룹별 최소 d SKU 1장만 유지 (가장 가까운 상위 일수).
 */
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

function fixedGroupKey(p: EnrichedPlan): string | null {
  const key = normalizeAllowanceKey(p.allowance_label || "");
  return key || null;
}

function dailyGroupKey(p: EnrichedPlan): string | null {
  const bucket = detectAllowanceBucket(p as ProductOption);
  if (bucket && bucket !== "unlimited") return bucket;
  const key = normalizeAllowanceKey(p.allowance_label || "");
  return key || null;
}

function unlimitedGroupKey(p: EnrichedPlan): string | null {
  const qos = (p.qos_raw || "").trim().toLowerCase().replace(/\s+/g, "");
  return qos ? `unlimited:${qos}` : "unlimited:unknown";
}

/** 매칭 풀에서 tripDays 이상인 최소 catalog 일수 (동적, tier 하드코딩 없음). */
function computeMatchedBillableDays(plans: EnrichedPlan[], tripDays: number): number {
  let min: number | null = null;
  for (const p of plans) {
    const d = extractDaysFromDaysRaw(p.days_raw);
    if (d == null || d < tripDays) continue;
    if (min == null || d < min) min = d;
  }
  return min ?? tripDays;
}

/** fixed 전용: 용량 오름차순 → 가격 오름차순 */
function sortFixedByAllowanceAsc(plans: EnrichedPlan[]): EnrichedPlan[] {
  return [...plans].sort((a, b) => {
    const ka = allowanceLabelSortKey(a.allowance_label || "");
    const kb = allowanceLabelSortKey(b.allowance_label || "");
    if (ka !== kb) return ka - kb;
    return comparePriceAsc(a, b);
  });
}

/** 로밍/로컬 동시 후보일 때: QOS 높은 것, 같으면 소비자가 낮은 것 */
function pickWinnerByQosThenPrice(candidates: EnrichedPlan[]): EnrichedPlan | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const qa = qosSortScoreMbps(a.qos_raw);
    const qb = qosSortScoreMbps(b.qos_raw);
    if (qb !== qa) return qb - qa;
    return comparePriceAsc(a, b);
  });
  return sorted[0] ?? null;
}

function pickCheapestInList(list: EnrichedPlan[]): EnrichedPlan | null {
  let best: EnrichedPlan | null = null;
  let bestPrice = Number.POSITIVE_INFINITY;
  for (const p of list) {
    const pr = p.recommended_price;
    if (pr == null || !Number.isFinite(pr)) continue;
    if (pr < bestPrice) {
      bestPrice = pr;
      best = p;
    }
  }
  return best;
}

function buildPlanGroups(pool: EnrichedPlan[], tripDays: number) {
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

function buildRecommended(
  pool: EnrichedPlan[],
  groups: ReturnType<typeof buildPlanGroups>,
): RecommendedPlan | null {
  const premiumCandidates = pool.filter(
    (p) => p.is_true_unlimited && isQos5MbpsForPremium(p.qos_raw),
  );
  const unlimitedPick = pickWinnerByQosThenPrice(premiumCandidates);
  if (unlimitedPick) {
    return { ...unlimitedPick, rec_source: "unlimited" };
  }

  const dailyPick = pickCheapestInList(groups.daily);
  if (dailyPick) {
    return { ...dailyPick, rec_source: "daily" };
  }

  const fixedPick = pickCheapestInList(groups.fixed);
  if (fixedPick) {
    return { ...fixedPick, rec_source: "fixed" };
  }

  return null;
}

function matchesFilters(row: Row, ctx: { country: string; days: number; allSelected: string[] }) {
  const covered = getPlanCoveredCountries(row.plan_name);
  const pt = (row.plan_type || "").trim().toLowerCase();

  if (pt !== "unlimited" && pt !== "daily" && pt !== "fixed") return false;

  const d = extractDaysFromDaysRaw(row.days_raw);
  if (d == null || d < ctx.days) return false;

  if (ctx.allSelected.length >= 2) {
    return (
      covered.length >= 2 && doesPlanCoverAllSelected(row.plan_name, ctx.allSelected)
    );
  }

  const singleOk =
    covered.length === 1 &&
    covered[0] === ctx.country &&
    (pt === "daily" || pt === "unlimited" || pt === "fixed");

  return singleOk;
}

/**
 * GET /api/bongsim/products/plans?country=jp&network=roaming&days=4&codes=jp,vn
 *
 * - `days` = 여정 일수(원본). daily/unlimited/fixed 모두 d>=days 후 그룹별 최소 d 1SKU.
 * - `matched_days` = 매칭 풀에서 d>=days 인 최소 catalog 일수 (안내 문구 M값).
 * - `network` 생략 시 roaming + local 모두 조회 (roaming | local 지정 가능)
 * - recommended_price = price_block.after.consumer_krw 만 (before 폴백 없음)
 * - is_true_unlimited: allowance_label 이 무제한/완전 무제한/unlimited 인 경우만 true
 * - flags.request_shipment = O, qos_raw 128kbps 제외 후 tierPool
 * - groups: tierPool 을 plan_type(unlimited|daily|fixed) 별 분류·정렬
 * - recommended: 5Mbps 무제한 → daily 최저가 → fixed 최저가 폴백, rec_source 부착
 * - plans: 국가·일수 matched + 발송/QOS 필터 통과 목록(가격 오름차순)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "").trim().toLowerCase();
  const networkRaw = (searchParams.get("network") || "").trim().toLowerCase();
  const daysStr = (searchParams.get("days") || "").trim();
  const days = parseInt(daysStr, 10);
  const codesRaw = (searchParams.get("codes") || "").trim();

  if (!country) {
    return jsonWithLeakGuard({ error: "country required" }, "bongsim.products.plans", { status: 400 });
  }
  if (networkRaw && networkRaw !== "roaming" && networkRaw !== "local") {
    return jsonWithLeakGuard(
      { error: "network must be roaming, local, or omitted" },
      "bongsim.products.plans",
      { status: 400 },
    );
  }
  if (!Number.isFinite(days) || days < 1) {
    return jsonWithLeakGuard({ error: "days must be a positive integer" }, "bongsim.products.plans", { status: 400 });
  }

  const fromCodes = codesRaw
    ? codesRaw
        .split(",")
        .map((c) => c.trim().toLowerCase())
        .filter(Boolean)
    : [country];
  const allSelected = [...new Set(fromCodes)];

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "DB not configured" }, "bongsim.products.plans", { status: 500 });
  }

  const networkParam: string | null = networkRaw ? networkRaw : null;

  try {
    const result = await pool.query(
      `
      SELECT
        option_api_id,
        plan_name,
        network_family,
        plan_type,
        days_raw,
        allowance_label,
        option_label,
        price_block,
        flags,
        qos_raw
      FROM bongsim_product_option
      WHERE ${BONGSIM_CATALOG_ACTIVE_WHERE}
        AND ($1::text IS NULL OR lower(network_family) = lower($1::text))
        AND plan_type IS NOT NULL
        AND lower(plan_type) IN ('unlimited', 'daily', 'fixed')
      ORDER BY plan_name, days_raw, (price_block->'after'->>'consumer_krw')::numeric ASC NULLS LAST
      `,
      [networkParam],
    );

    const ctx = { country, days, allSelected };
    const matched = (result.rows as Row[])
      .filter((row) => matchesFilters(row, ctx))
      .filter((row) => passesShipmentAndQosFilter(row));

    const enriched = matched.map(enrich).sort(comparePriceAsc);

    const tierPool = applyTierInputFilters(enriched);
    const groups = buildPlanGroups(tierPool, days);
    const recommended =
      allSelected.length >= 2 ? null : buildRecommended(tierPool, groups);
    const matched_days = computeMatchedBillableDays(enriched, days);

    return jsonWithLeakGuard(
      { plans: enriched, recommended, groups, trip_days: days, matched_days },
      "bongsim.products.plans",
    );
  } catch (e) {
    console.error("[plans]", e);
    return jsonWithLeakGuard({ error: "query failed" }, "bongsim.products.plans", { status: 500 });
  }
}
