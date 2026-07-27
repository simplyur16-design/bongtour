import { unstable_cache } from "next/cache";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getPgPool, classifyBongsimPgError, resetBongsimPgPoolAfterConnectTimeout } from "@/lib/bongsim/db/pool";
import { queryPlanCatalog } from "@/lib/bongsim/recommend/query-plan-catalog";

export const revalidate = 120;

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: plans 120s cache — manifest

const PLANS_REVALIDATE_SEC = 120;

/**
 * GET /api/bongsim/products/plans?country=jp&network=roaming&days=4&codes=jp,vn
 *
 * - `days` = 여정 일수(원본). daily/unlimited/fixed 모두 d>=days 후 그룹별 최소 d 1SKU.
 * - `matched_days` = 매칭 풀에서 d>=days 인 최소 catalog 일수 (안내 문구 M값).
 * - `network` 생략 시 roaming + local 모두 조회 (roaming | local 지정 가능)
 * - recommended_price = price_block.after.consumer_krw 만 (before·권장가 폴백 없음; 필드명은 API 호환)
 * - groups: tierPool 을 plan_type(unlimited|daily|fixed) 별 분류·정렬
 * - 다국가·지역 패키지 동일 추천 규칙 (binary → recommended_by_auth)
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
  const allSelected = [...new Set(fromCodes)].sort();

  const pool = getPgPool();
  if (!pool) {
    return jsonWithLeakGuard({ error: "DB not configured" }, "bongsim.products.plans", { status: 500 });
  }

  const networkParam: "roaming" | "local" | null = networkRaw ? (networkRaw as "roaming" | "local") : null;
  const cacheKey = [
    "bongsim-plans-v1",
    country,
    String(days),
    allSelected.join(","),
    networkParam ?? "all",
  ];

  try {
    const payload = await unstable_cache(
      async () =>
        queryPlanCatalog({
          pool: getPgPool()!,
          country,
          days,
          allSelected,
          network: networkParam,
        }),
      cacheKey,
      {
        revalidate: PLANS_REVALIDATE_SEC,
        tags: ["bongsim-plans", `bongsim-plans-${country}`],
      },
    )();

    const response = jsonWithLeakGuard(payload, "bongsim.products.plans");
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${PLANS_REVALIDATE_SEC}, stale-while-revalidate=${PLANS_REVALIDATE_SEC * 2}`,
    );
    return response;
  } catch (e) {
    console.error("[plans]", e);
    resetBongsimPgPoolAfterConnectTimeout(e);
    const reason = classifyBongsimPgError(e);
    return jsonWithLeakGuard(
      { error: "query failed", reason },
      "bongsim.products.plans",
      { status: 500 },
    );
  }
}
