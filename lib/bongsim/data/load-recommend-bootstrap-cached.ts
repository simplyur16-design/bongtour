import { unstable_cache } from "next/cache";
import {
  loadBongsimRecommendBootstrap,
  type BongsimRecommendBootstrapResult,
} from "@/lib/bongsim/data/load-recommend-bootstrap";

export const BONGSIM_RECOMMEND_BOOTSTRAP_REVALIDATE_SEC = 120;

// REGRESSION-FREEZE[bongsim-catalog-list-perf]: recommend bootstrap 실패 결과 캐시 금지 — manifest

async function fetchBootstrapOrThrow(): Promise<Extract<BongsimRecommendBootstrapResult, { ok: true }>> {
  const res = await loadBongsimRecommendBootstrap();
  if (!res.ok) throw new Error(`bongsim_recommend_bootstrap_${res.reason}`);
  return res;
}

export async function loadBongsimRecommendBootstrapCached(): Promise<BongsimRecommendBootstrapResult> {
  try {
    return await unstable_cache(fetchBootstrapOrThrow, ["bongsim-recommend-bootstrap-v2"], {
      revalidate: BONGSIM_RECOMMEND_BOOTSTRAP_REVALIDATE_SEC,
      tags: ["bongsim-recommend-bootstrap"],
    })();
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("connection_timeout")) return { ok: false, reason: "connection_timeout" };
    if (msg.includes("db_unconfigured")) return { ok: false, reason: "db_unconfigured" };
    return { ok: false, reason: "db_error" };
  }
}
