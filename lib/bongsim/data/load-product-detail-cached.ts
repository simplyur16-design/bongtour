import { unstable_cache } from "next/cache";
import {
  getProductDetailByOptionApiId,
  type GetProductDetailResult,
} from "@/lib/bongsim/data/get-product-detail-by-option-api-id";

// REGRESSION-FREEZE[esim-fulfill-keep-catalog-pipe]: homepage detail same 120s cache as list — manifest

export const BONGSIM_PRODUCT_DETAIL_REVALIDATE_SEC = 120;

async function loadOrThrow(optionApiId: string): Promise<Extract<GetProductDetailResult, { ok: true }>> {
  const res = await getProductDetailByOptionApiId(optionApiId);
  if (!res.ok) throw new Error(`bongsim_detail_${res.reason}`);
  return res;
}

/** 홈 상품 상세 — 탭마다 DB를 치지 않게 목록과 같은 120s 캐시. 실패는 캐시하지 않음. */
export async function getProductDetailByOptionApiIdCached(
  optionApiId: string,
): Promise<GetProductDetailResult> {
  const id = optionApiId.trim();
  if (!id) return { ok: false, reason: "not_found" };
  try {
    return await unstable_cache(async () => loadOrThrow(id), ["bongsim-product-detail-v1", id], {
      revalidate: BONGSIM_PRODUCT_DETAIL_REVALIDATE_SEC,
      tags: ["bongsim-product-detail"],
    })();
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (msg.includes("not_found")) return { ok: false, reason: "not_found" };
    if (msg.includes("connection_timeout")) return { ok: false, reason: "connection_timeout" };
    if (msg.includes("db_unconfigured")) return { ok: false, reason: "db_unconfigured" };
    return { ok: false, reason: "db_error" };
  }
}
