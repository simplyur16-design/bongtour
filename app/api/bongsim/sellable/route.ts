import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import {
  checkDestinationSellable,
  checkOptionSellable,
  loadSellableDestinationCodes,
} from "@/lib/bongsim/data/sellable-destinations";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

// REGRESSION-FREEZE[bongsim-esim-hide-unavailable]: 판매 가능 여부(읽기 전용) — 가격·공급가 미노출 — manifest

/**
 * GET /api/bongsim/sellable?option=<option_api_id>  → { sellable }
 * GET /api/bongsim/sellable?country=<iso2|rg-*>     → { sellable }
 * GET /api/bongsim/sellable                         → { destinations: string[] }
 *
 * 판정 실패(DB 장애)는 503 — 호출 측은 숨기지 않고 기존 화면 유지(fail-open).
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const option = searchParams.get("option");
  const country = searchParams.get("country");

  if (option != null || country != null) {
    const res = option != null ? await checkOptionSellable(option) : await checkDestinationSellable(country ?? "");
    if (!res.ok) {
      return jsonWithLeakGuard({ error: "check_failed", reason: res.reason }, "bongsim.sellable", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }
    return jsonWithLeakGuard({ sellable: res.sellable }, "bongsim.sellable", {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    });
  }

  const list = await loadSellableDestinationCodes();
  if (!list.ok) {
    return jsonWithLeakGuard({ error: "check_failed", reason: list.reason }, "bongsim.sellable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return jsonWithLeakGuard({ destinations: list.codes }, "bongsim.sellable", {
    headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" },
  });
}
