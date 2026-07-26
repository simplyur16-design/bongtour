import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT,
  buyerHasPriorPaidEsimOrder,
  computeEsimFirstPurchaseDiscountKrw,
} from "@/lib/bongsim/promo/esim-first-purchase-discount";

// REGRESSION-FREEZE[simplyur-surface-layout-p2]: 첫구매 프리뷰 API — manifest

export type EsimFirstPurchasePreviewResult =
  | {
      eligible: true;
      discount_rate_pct: number;
      discount_krw: number;
      grand_total_krw: number;
      subtotal_krw: number;
    }
  | {
      eligible: false;
      reason: "missing_buyer" | "invalid_subtotal" | "prior_purchase" | "press_member" | "db_unconfigured";
    };

// REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: first-purchase skip when affiliationVerified — manifest
async function loadUserOccupationDiscountEligible(
  client: PoolClient,
  userId: string,
): Promise<boolean> {
  const r = await client.query<{ affiliationVerified: boolean }>(
    `SELECT COALESCE("affiliationVerified", false) AS "affiliationVerified"
     FROM "User" WHERE id = $1 LIMIT 1`,
    [userId.trim()],
  );
  const row = r.rows[0];
  return Boolean(row?.affiliationVerified);
}

/** 첫구매 15% UI·API 프리뷰 — 결제 confirm 과 동일 우선순위(직군 > 쿠폰 > 첫구매). */
export async function resolveEsimFirstPurchasePreview(input: {
  subtotal_krw: number;
  buyer_email?: string | null;
  bongtour_user_id?: string | null;
}): Promise<EsimFirstPurchasePreviewResult> {
  const subtotal = Math.trunc(input.subtotal_krw);
  const email = (input.buyer_email ?? "").trim();
  const userId = (input.bongtour_user_id ?? "").trim();

  if (!email && !userId) {
    return { eligible: false, reason: "missing_buyer" };
  }
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { eligible: false, reason: "invalid_subtotal" };
  }

  const pool = getPgPool();
  if (!pool) return { eligible: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  try {
    if (userId) {
      const occupationEligible = await loadUserOccupationDiscountEligible(client, userId);
      if (occupationEligible) {
        return { eligible: false, reason: "press_member" };
      }
    }

    const hasPrior = await buyerHasPriorPaidEsimOrder(client, {
      bongtourUserId: userId || null,
      buyerEmail: email,
    });
    if (hasPrior) {
      return { eligible: false, reason: "prior_purchase" };
    }

    const discount_krw = computeEsimFirstPurchaseDiscountKrw(subtotal);
    if (discount_krw <= 0) {
      return { eligible: false, reason: "invalid_subtotal" };
    }

    return {
      eligible: true,
      discount_rate_pct: ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT,
      discount_krw,
      grand_total_krw: Math.max(0, subtotal - discount_krw),
      subtotal_krw: subtotal,
    };
  } finally {
    client.release();
  }
}
