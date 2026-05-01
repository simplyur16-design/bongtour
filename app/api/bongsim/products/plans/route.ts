import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseFlagsJson } from "@/lib/bongsim/data/parse-product-json";
import { doesPlanCoverAllSelected, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import {
  detectAllowanceBucket,
  type AllowanceBucketId,
} from "@/lib/bongsim/recommend/allowance-buckets";
import {
  computeRecommendedPrice,
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

function enrich(row: Row) {
  const price_block = row.price_block as ProductOption["price_block"];
  const recommended_price = computeRecommendedPrice(price_block);
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
 * 384kbps 상품: 같은 일수·같은 권장가의 무제한(1Mbps 이상)이 있으면 제외.
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
  return i >= 0 ? i : -1;
}

/** 로밍/로컬 동시 후보일 때: QOS 높은 것, 같으면 권장가 낮은 것 */
function pickWinnerByQosThenPrice(candidates: EnrichedPlan[]): EnrichedPlan | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const qa = qosSortScoreMbps(a.qos_raw);
    const qb = qosSortScoreMbps(b.qos_raw);
    if (qb !== qa) return qb - qa;
    const pa = a.recommended_price ?? Number.POSITIVE_INFINITY;
    const pb = b.recommended_price ?? Number.POSITIVE_INFINITY;
    return pa - pb;
  });
  return sorted[0] ?? null;
}

function withTierLabel(tier_label: string, plan: EnrichedPlan | null) {
  if (!plan) return null;
  return { tier_label, ...plan };
}

function pickBudgetTier(pool: EnrichedPlan[]): EnrichedPlan | null {
  const minUnlPrice = (() => {
    const prices = pool.filter(isTrueUnlimited1MbpsPlus).map((p) => p.recommended_price);
    const finite = prices.filter((x): x is number => x != null && Number.isFinite(x));
    if (!finite.length) return null;
    return Math.min(...finite);
  })();

  const capped = pool.filter((p) => {
    if (p.is_true_unlimited) return false;
    const bucket = detectAllowanceBucket(p as ProductOption);
    if (bucket == null || bucket === "unlimited") return false;
    const price = p.recommended_price;
    if (minUnlPrice != null) {
      if (price == null || price >= minUnlPrice) return false;
    }
    return true;
  });
  if (!capped.length) return null;

  capped.sort((a, b) => {
    const ba = detectAllowanceBucket(a as ProductOption);
    const bb = detectAllowanceBucket(b as ProductOption);
    const ra = capacityRank(ba);
    const rb = capacityRank(bb);
    if (rb !== ra) return rb - ra;
    const pa = a.recommended_price ?? Number.POSITIVE_INFINITY;
    const pb = b.recommended_price ?? Number.POSITIVE_INFINITY;
    if (pa !== pb) return pa - pb;
    return qosSortScoreMbps(b.qos_raw) - qosSortScoreMbps(a.qos_raw);
  });
  return capped[0] ?? null;
}

function pickCheapestInPool(pool: EnrichedPlan[]): EnrichedPlan | null {
  let best: EnrichedPlan | null = null;
  let bestPrice = Number.POSITIVE_INFINITY;
  for (const p of pool) {
    const pr = p.recommended_price;
    if (pr == null || !Number.isFinite(pr)) continue;
    if (pr < bestPrice) {
      bestPrice = pr;
      best = p;
    }
  }
  return best;
}

function buildRecommendedTiers(pool: EnrichedPlan[]) {
  const premiumCandidates = pool.filter((p) => p.is_true_unlimited && isQos5MbpsForPremium(p.qos_raw));
  const valueCandidates = pool.filter((p) => {
    if (!p.is_true_unlimited) return false;
    if (isQos5MbpsForPremium(p.qos_raw)) return false;
    const m = parseMbpsFromQos(p.qos_raw);
    return m != null && m >= 1;
  });

  const premium = withTierLabel("추천", pickWinnerByQosThenPrice(premiumCandidates));
  const value = withTierLabel("실속", pickWinnerByQosThenPrice(valueCandidates));

  const budgetPlan = pickBudgetTier(pool);
  const budget = budgetPlan ? withTierLabel("알뜰", budgetPlan) : null;

  let cheapestPlan = pickCheapestInPool(pool);
  if (
    budgetPlan &&
    cheapestPlan &&
    budgetPlan.option_api_id === cheapestPlan.option_api_id
  ) {
    cheapestPlan = null;
  }
  const cheapest = cheapestPlan ? withTierLabel("최저가", cheapestPlan) : null;

  return { premium, value, budget, cheapest };
}

function matchesFilters(row: Row, ctx: { country: string; days: number; allSelected: string[] }) {
  const d = extractDaysFromDaysRaw(row.days_raw);
  if (d !== ctx.days) return false;

  const covered = getPlanCoveredCountries(row.plan_name);
  const pt = (row.plan_type || "").trim().toLowerCase();

  if (pt !== "unlimited" && pt !== "daily") return false;

  const multiUnlimitedOk =
    ctx.allSelected.length >= 2 &&
    pt === "unlimited" &&
    isTrueUnlimited(row) &&
    covered.length >= 2 &&
    doesPlanCoverAllSelected(row.plan_name, ctx.allSelected);

  /** 저속 무제한(plan_type unlimited + allowance 500MB 등)도 플랜 선택·용량 버킷용으로 포함, `is_true_unlimited`로 구분 */
  const singleOk =
    covered.length === 1 &&
    covered[0] === ctx.country &&
    (pt === "daily" || pt === "unlimited");

  return multiUnlimitedOk || singleOk;
}

/**
 * GET /api/bongsim/products/plans?country=jp&network=roaming&days=4&codes=jp,vn
 *
 * - `network` 생략 시 roaming + local 모두 조회 (지정 시 기존과 동일하게 roaming | local 만 허용)
 * - 단일국가 / 다국가 무제한 포함
 * - recommended_price = after.recommended_krw ?? before.recommended_krw (권장판매가)
 * - is_true_unlimited: allowance_label 이 정확히 무제한/완전 무제한/unlimited 인 경우만 true (저속 무제한은 false)
 * - flags.request_shipment 가 O 가 아니거나 qos_raw 가 128kbps 인 행은 제외
 * - recommended_tiers: 필터 후 선정 4티어 premium/value/budget/cheapest (권장가 recommended_krw)
 * - plans 배열: 필터 전 matched 목록 유지
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const country = (searchParams.get("country") || "").trim().toLowerCase();
  const networkRaw = (searchParams.get("network") || "").trim().toLowerCase();
  const daysStr = (searchParams.get("days") || "").trim();
  const days = parseInt(daysStr, 10);
  const codesRaw = (searchParams.get("codes") || "").trim();

  if (!country) {
    return NextResponse.json({ error: "country required" }, { status: 400 });
  }
  if (networkRaw && networkRaw !== "roaming" && networkRaw !== "local") {
    return NextResponse.json({ error: "network must be roaming, local, or omitted" }, { status: 400 });
  }
  if (!Number.isFinite(days) || days < 1) {
    return NextResponse.json({ error: "days must be a positive integer" }, { status: 400 });
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
    return NextResponse.json({ error: "DB not configured" }, { status: 500 });
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
      WHERE ($1::text IS NULL OR lower(network_family) = lower($1::text))
        AND plan_type IS NOT NULL
        AND lower(plan_type) IN ('unlimited', 'daily')
      ORDER BY plan_name, days_raw, COALESCE(
        (price_block->'after'->>'recommended_krw')::numeric,
        (price_block->'before'->>'recommended_krw')::numeric
      ) ASC NULLS LAST
      `,
      [networkParam],
    );

    const ctx = { country, days, allSelected };
    const matched = (result.rows as Row[])
      .filter((row) => matchesFilters(row, ctx))
      .filter((row) => passesShipmentAndQosFilter(row));

    const enriched = matched.map(enrich).sort((a, b) => {
      const pa = a.recommended_price;
      const pb = b.recommended_price;
      if (pa != null && pb != null) return pa - pb;
      if (pa != null) return -1;
      if (pb != null) return 1;
      return 0;
    });

    const tierPool = applyTierInputFilters(enriched);
    const recommended_tiers = buildRecommendedTiers(tierPool);

    return NextResponse.json({ plans: enriched, recommended_tiers });
  } catch (e) {
    console.error("[plans]", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
