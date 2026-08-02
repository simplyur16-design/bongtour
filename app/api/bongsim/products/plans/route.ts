import { unstable_cache } from "next/cache";
import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import {
  getPgPool,
  classifyBongsimPgError,
  isBongsimPgTlsHandshakeIssue,
  probePgPoolTlsOrFallback,
  resetBongsimPgPoolAfterConnectTimeout,
  withBongsimCatalogRetry,
} from "@/lib/bongsim/db/pool";
import { queryPlanCatalog } from "@/lib/bongsim/recommend/query-plan-catalog";

export const revalidate = 120;

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: plans 120s cache — manifest

const PLANS_REVALIDATE_SEC = 120;

function plansErrorResponse(reason: string): NextResponse {
  const status = reason === "connection_timeout" || reason === "db_unconfigured" ? 503 : 500;
  const res = jsonWithLeakGuard(
    { error: reason === "db_unconfigured" ? "DB not configured" : "query failed", reason },
    "bongsim.products.plans",
    { status },
  );
  res.headers.set("Cache-Control", "no-store");
  return res;
}

async function loadPlansPayload(params: {
  country: string;
  days: number;
  allSelected: string[];
  network: "roaming" | "local" | null;
}) {
  await probePgPoolTlsOrFallback();
  const pool = getPgPool();
  if (!pool) throw new Error("db_unconfigured");
  return queryPlanCatalog({
    pool,
    country: params.country,
    days: params.days,
    allSelected: params.allSelected,
    network: params.network,
  });
}

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

  const networkParam: "roaming" | "local" | null = networkRaw ? (networkRaw as "roaming" | "local") : null;
  const cacheKey = [
    "bongsim-plans-v3",
    country,
    String(days),
    allSelected.join(","),
    networkParam ?? "all",
  ];

  try {
    const payload = await unstable_cache(
      async () =>
        withBongsimCatalogRetry(() =>
          loadPlansPayload({ country, days, allSelected, network: networkParam }),
        ),
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
    if (isBongsimPgTlsHandshakeIssue(e)) {
      await probePgPoolTlsOrFallback();
    }
    resetBongsimPgPoolAfterConnectTimeout(e);
    try {
      // cache 콜백 밖 1회 — 인스턴스 간 풀 잔상으로 cold miss만 죽는 경우 복구
      const payload = await withBongsimCatalogRetry(() =>
        loadPlansPayload({ country, days, allSelected, network: networkParam }),
      );
      const response = jsonWithLeakGuard(payload, "bongsim.products.plans");
      response.headers.set(
        "Cache-Control",
        `public, s-maxage=${PLANS_REVALIDATE_SEC}, stale-while-revalidate=${PLANS_REVALIDATE_SEC * 2}`,
      );
      return response;
    } catch (e2) {
      console.error("[plans] retry failed", e2);
      resetBongsimPgPoolAfterConnectTimeout(e2);
      const msg = String(e2 instanceof Error ? e2.message : e2);
      if (msg.includes("db_unconfigured")) return plansErrorResponse("db_unconfigured");
      return plansErrorResponse(classifyBongsimPgError(e2));
    }
  }
}
