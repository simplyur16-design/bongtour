import { unstable_cache } from "next/cache";
import {
  loadBongsimRecommendBootstrap,
  type BongsimRecommendBootstrapResult,
} from "@/lib/bongsim/data/load-recommend-bootstrap";

export const BONGSIM_RECOMMEND_BOOTSTRAP_REVALIDATE_SEC = 120;

export function loadBongsimRecommendBootstrapCached(): Promise<BongsimRecommendBootstrapResult> {
  return unstable_cache(
    () => loadBongsimRecommendBootstrap(),
    ["bongsim-recommend-bootstrap"],
    {
      revalidate: BONGSIM_RECOMMEND_BOOTSTRAP_REVALIDATE_SEC,
      tags: ["bongsim-recommend-bootstrap"],
    },
  )();
}
