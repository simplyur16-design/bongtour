import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseFlagsJson } from "@/lib/bongsim/data/parse-product-json";
import { doesPlanCoverAllSelected, getPlanCoveredCountries } from "@/lib/bongsim/plan-coverage-map";
import { detectAllowanceBucket } from "@/lib/bongsim/recommend/allowance-buckets";
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

function is300mbAllowanceLabel(allowance_label: string): boolean {
  const compact = allowance_label.toLowerCase().replace(/\s/g, "");
  return /300\s*mb|300mb|0\.3gb/.test(compact);
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

function buildRecommendedTiers(plans: EnrichedPlan[]) {
  const premiumCandidates = plans.filter((p) => p.is_true_unlimited && isQos5MbpsForPremium(p.qos_raw));
  const valueCandidates = plans.filter((p) => {
    if (!p.is_true_unlimited) return false;
    if (isQos5MbpsForPremium(p.qos_raw)) return false;
    const m = parseMbpsFromQos(p.qos_raw);
    return m != null && m >= 1;
  });

  const asOption = (p: EnrichedPlan) => p as ProductOption;
  const balance3 = plans.filter((p) => detectAllowanceBucket(asOption(p)) === "3gb");
  const balance2 = plans.filter((p) => detectAllowanceBucket(asOption(p)) === "2gb");
  const budget1 = plans.filter((p) => detectAllowanceBucket(asOption(p)) === "1gb");
  const cheap500 = plans.filter((p) => detectAllowanceBucket(asOption(p)) === "500mb");
  const cheap300 = plans.filter((p) => is300mbAllowanceLabel(p.allowance_label));

  return {
    premium: withTierLabel("프리미엄", pickWinnerByQosThenPrice(premiumCandidates)),
    value: withTierLabel("가성비", pickWinnerByQosThenPrice(valueCandidates)),
    balance: withTierLabel(
      "밸런스",
      pickWinnerByQosThenPrice(balance3) ?? pickWinnerByQosThenPrice(balance2),
    ),
    budget: withTierLabel("알뜰", pickWinnerByQosThenPrice(budget1)),
    cheapest: withTierLabel(
      "최저가",
      pickWinnerByQosThenPrice(cheap500) ?? pickWinnerByQosThenPrice(cheap300),
    ),
  };
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
 * - recommended_tiers: 서버 선정 5티어 (plans 배열은 기존과 동일 유지)
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

    const recommended_tiers = buildRecommendedTiers(enriched);

    return NextResponse.json({ plans: enriched, recommended_tiers });
  } catch (e) {
    console.error("[plans]", e);
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
}
