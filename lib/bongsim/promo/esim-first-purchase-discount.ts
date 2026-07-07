import type { PoolClient } from "pg";

/** eSIM 첫구매 자동 할인(%) — 쿠폰 코드 없이 서버 적용. bongsim·simplyur 공통. */
export const ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT = 15;

// REGRESSION-FREEZE[esim-first-purchase-discount-15pct]: 첫구매 15% — manifest

export function computeEsimFirstPurchaseDiscountKrw(subtotal_krw: number): number {
  const sub = Math.trunc(subtotal_krw);
  if (!Number.isFinite(sub) || sub <= 0) return 0;
  return Math.floor((sub * ESIM_FIRST_PURCHASE_DISCOUNT_RATE_PCT) / 100);
}

function buildBuyerMatch(
  opts: { bongtourUserId?: string | null; buyerEmail: string },
  params: unknown[],
): string | null {
  const uid = (opts.bongtourUserId ?? "").trim();
  const email = opts.buyerEmail.trim().toLowerCase();
  const clauses: string[] = [];
  if (uid) {
    clauses.push(`(o.consents->>'bongtour_user_id') = $${params.length + 1}`);
    params.push(uid);
  }
  if (email) {
    clauses.push(`lower(o.buyer_email) = $${params.length + 1}`);
    params.push(email);
  }
  if (clauses.length === 0) return null;
  return clauses.length > 1 ? `(${clauses.join(" OR ")})` : clauses[0]!;
}

/** 결제 완료(paid/delivered/fulfilled) eSIM 주문이 있으면 첫구매 아님. */
export async function buyerHasPriorPaidEsimOrder(
  client: PoolClient,
  opts: { bongtourUserId?: string | null; buyerEmail: string },
): Promise<boolean> {
  const params: unknown[] = [];
  const buyerMatch = buildBuyerMatch(opts, params);
  if (!buyerMatch) return false;

  const r = await client.query(
    `SELECT 1
     FROM bongsim_order o
     WHERE o.status IN ('paid', 'delivered', 'fulfilled')
       AND ${buyerMatch}
     LIMIT 1`,
    params,
  );
  return (r.rowCount ?? 0) > 0;
}
