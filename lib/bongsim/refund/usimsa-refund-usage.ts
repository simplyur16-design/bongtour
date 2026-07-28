/**
 * 환불 가능 여부 — 유심사 일별 사용량(미사용 = 0MB) 기준.
 * ICCID(발급)만으로는 환불 불가 처리하지 않는다.
 */
import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { fetchUsimsaTopupDailyUsage } from "@/lib/bongsim/supplier/usimsa/usage-api";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";
import { isUsimsaUnusedMb } from "@/lib/bongsim/refund/usimsa-usage-threshold";

export { USIMSA_USAGE_MB_EPSILON } from "@/lib/bongsim/refund/usimsa-usage-threshold";

export type UsimsaRefundUsageCheck =
  | { ok: true; totalUsedMb: number }
  | { ok: false; reason: "usage_check_failed"; message: string }
  | { ok: false; reason: "esim_used"; message: string; totalUsedMb: number };

/** REGRESSION-FREEZE[bongsim-admin-esim-usage-check]: 관리자 미사용 확인 SSOT — manifest */
export type UsimsaOrderUsageSummary =
  | { ok: true; unused: boolean; totalUsedMb: number; topupCount: number }
  | { ok: false; reason: "usage_check_failed"; message: string };

async function listUsimsaTopupIdsForOrder(
  client: PoolClient,
  orderId: string,
): Promise<string[]> {
  const r = await client.query<{ topup_id: string }>(
    `SELECT topup_id FROM bongsim_fulfillment_topup
      WHERE order_id = $1::uuid AND supplier_id = 'usimsa'
        AND status NOT IN ('canceled', 'failed')
      ORDER BY created_at ASC`,
    [orderId],
  );
  return r.rows.map((row) => row.topup_id.trim()).filter(Boolean);
}

export async function summarizeUsimsaOrderDataUsage(
  orderId: string,
  existingClient?: PoolClient,
): Promise<UsimsaOrderUsageSummary> {
  const id = orderId.trim();
  const pool = getPgPool();
  if (!pool && !existingClient) {
    return { ok: false, reason: "usage_check_failed", message: "DB 미설정" };
  }

  const client = existingClient ?? (await pool!.connect());
  const release = !existingClient;

  try {
    const topupIds = await listUsimsaTopupIdsForOrder(client, id);
    if (topupIds.length === 0) {
      return { ok: true, unused: true, totalUsedMb: 0, topupCount: 0 };
    }

    let totalUsedMb = 0;
    for (const topupId of topupIds) {
      let norm;
      try {
        norm = await fetchUsimsaTopupDailyUsage(topupId);
      } catch {
        return {
          ok: false,
          reason: "usage_check_failed",
          message: "데이터 사용량을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      if (!isUsimsaSuccess(norm.code)) {
        return {
          ok: false,
          reason: "usage_check_failed",
          message: "유심사 사용량 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      const mb = norm.history.reduce(
        (s, h) => s + (Number.isFinite(h.usageMb) ? h.usageMb : 0),
        0,
      );
      totalUsedMb += mb;
    }

    return {
      ok: true,
      unused: isUsimsaUnusedMb(totalUsedMb),
      totalUsedMb,
      topupCount: topupIds.length,
    };
  } finally {
    if (release) client.release();
  }
}

export async function checkUsimsaOrderDataUsageForRefund(
  orderId: string,
  existingClient?: PoolClient,
): Promise<UsimsaRefundUsageCheck> {
  const summary = await summarizeUsimsaOrderDataUsage(orderId, existingClient);
  if (!summary.ok) {
    return {
      ok: false,
      reason: "usage_check_failed",
      message:
        "데이터 사용량을 확인하지 못해 취소할 수 없습니다. 잠시 후 다시 시도하거나 고객센터로 문의해 주세요.",
    };
  }
  if (!summary.unused) {
    return {
      ok: false,
      reason: "esim_used",
      message: `이미 데이터를 사용한 eSIM은 취소할 수 없습니다. (사용량 약 ${summary.totalUsedMb.toFixed(1)}MB)`,
      totalUsedMb: summary.totalUsedMb,
    };
  }
  return { ok: true, totalUsedMb: summary.totalUsedMb };
}
