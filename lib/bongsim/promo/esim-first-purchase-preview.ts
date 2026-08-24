import type { PoolClient } from "pg";
import { BONGSIM_CATALOG_ACTIVE_WHERE } from "@/lib/bongsim/catalog/active-product-sql";
import type { BongsimProductOptionDbRow } from "@/lib/bongsim/data/bongsim-product-option-db-row";
import { mapDbRowToProductOptionV1 } from "@/lib/bongsim/data/map-row-to-product-option-v1";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT,
  buyerHasPriorPaidEsimOrder,
  computeEsimFirstPurchaseDiscountKrw,
} from "@/lib/bongsim/promo/esim-first-purchase-discount";
import { isKoreaSingleCountryProduct } from "@/lib/simplyur/catalog/korea-product-filter";
import { isSimplyurCheckoutChannel } from "@/lib/simplyur/checkout/channel";
import { selectSimplyurChargedUnitPriceKrw } from "@/lib/simplyur/data/pricing-select-charged";
import {
  SIMPLYUR_LAUNCH_DISCOUNT_RATE_PCT,
  computeSimplyurLaunchDiscountForCheckoutLines,
} from "@/lib/simplyur/pricing/launch-discount";

// REGRESSION-FREEZE[simplyur-surface-layout-p2]: 첫구매 프리뷰 API — manifest
// REGRESSION-FREEZE[simplyur-launch-discount-14pct]: simplyur preview uses 14% + floors — manifest

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
      reason:
        | "missing_buyer"
        | "invalid_subtotal"
        | "prior_purchase"
        | "press_member"
        | "db_unconfigured"
        | "not_applicable";
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

async function resolveSimplyurLaunchPreview(
  client: PoolClient,
  optionApiId: string,
  quantity: number,
): Promise<EsimFirstPurchasePreviewResult> {
  const id = optionApiId.trim();
  const qty = Math.min(10, Math.max(1, Math.trunc(quantity) || 1));
  if (!id) return { eligible: false, reason: "not_applicable" };

  const pr = await client.query<BongsimProductOptionDbRow>(
    `SELECT * FROM bongsim_product_option WHERE option_api_id = $1 AND ${BONGSIM_CATALOG_ACTIVE_WHERE} LIMIT 1`,
    [id],
  );
  const row = pr.rows[0];
  if (!row) return { eligible: false, reason: "not_applicable" };

  const opt = mapDbRowToProductOptionV1(row);
  if (!isKoreaSingleCountryProduct(opt)) {
    return { eligible: false, reason: "not_applicable" };
  }
  const { unit_krw } = selectSimplyurChargedUnitPriceKrw(opt.price_block);
  if (unit_krw <= 0) return { eligible: false, reason: "not_applicable" };

  const subtotal_krw = unit_krw * qty;
  const discount_krw = computeSimplyurLaunchDiscountForCheckoutLines([
    { unit_krw, quantity: qty, price_block: opt.price_block },
  ]);
  if (discount_krw <= 0) {
    return { eligible: false, reason: "not_applicable" };
  }

  return {
    eligible: true,
    discount_rate_pct: SIMPLYUR_LAUNCH_DISCOUNT_RATE_PCT,
    discount_krw,
    grand_total_krw: Math.max(0, subtotal_krw - discount_krw),
    subtotal_krw,
  };
}

/** 첫구매 UI·API 프리뷰 — confirm 과 동일. bongsim 15% / simplyur 14%+바닥. */
export async function resolveEsimFirstPurchasePreview(input: {
  subtotal_krw: number;
  buyer_email?: string | null;
  bongtour_user_id?: string | null;
  checkout_channel?: string | null;
  option_api_id?: string | null;
  quantity?: number | null;
}): Promise<EsimFirstPurchasePreviewResult> {
  const subtotal = Math.trunc(input.subtotal_krw);
  const email = (input.buyer_email ?? "").trim();
  const userId = (input.bongtour_user_id ?? "").trim();
  const simplyur = isSimplyurCheckoutChannel(input.checkout_channel);

  if (!email && !userId) {
    return { eligible: false, reason: "missing_buyer" };
  }
  if (!simplyur && (!Number.isFinite(subtotal) || subtotal <= 0)) {
    return { eligible: false, reason: "invalid_subtotal" };
  }

  const pool = getPgPool();
  if (!pool) return { eligible: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  try {
    if (!simplyur && userId) {
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

    if (simplyur) {
      return resolveSimplyurLaunchPreview(client, input.option_api_id ?? "", input.quantity ?? 1);
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
