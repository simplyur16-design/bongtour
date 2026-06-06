import type { PoolClient } from "pg";

/** 2026년 6월 eSIM 구매자당 1회 자동 할인(%) — 할인코드 없음 */
export const JUNE_2026_FIRST_PURCHASE_RATE_PCT = 10;

const JUNE_2026_YEAR = 2026;
/** JS Date#getMonth — 6월 = 5 */
const JUNE_2026_MONTH = 5;

export function isJune2026PromoActive(now: Date = new Date()): boolean {
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getFullYear() === JUNE_2026_YEAR && kst.getMonth() === JUNE_2026_MONTH;
}

export function computeJune2026FirstPurchaseDiscountKrw(subtotal_krw: number): number {
  const sub = Math.trunc(subtotal_krw);
  if (!Number.isFinite(sub) || sub <= 0) return 0;
  return Math.floor((sub * JUNE_2026_FIRST_PURCHASE_RATE_PCT) / 100);
}

/** 결제 완료(paid/delivered/fulfilled) 주문 중 6월 1회 할인 사용 여부 */
export async function buyerAlreadyUsedJune2026FirstPurchaseDiscount(
  client: PoolClient,
  opts: { bongtourUserId?: string | null; buyerEmail: string },
): Promise<boolean> {
  const uid = (opts.bongtourUserId ?? "").trim();
  const email = opts.buyerEmail.trim().toLowerCase();
  if (!uid && !email) return false;

  const buyerClauses: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (uid) {
    buyerClauses.push(`(o.consents->>'bongtour_user_id') = $${i++}`);
    params.push(uid);
  }
  if (email) {
    buyerClauses.push(`lower(o.buyer_email) = $${i++}`);
    params.push(email);
  }
  const buyerMatch = buyerClauses.length > 1 ? `(${buyerClauses.join(" OR ")})` : buyerClauses[0]!;

  const r = await client.query(
    `SELECT 1
     FROM bongsim_order o
     WHERE o.status IN ('paid', 'delivered', 'fulfilled')
       AND COALESCE((o.consents->>'june_2026_first_purchase_discount')::boolean, false) = true
       AND ${buyerMatch}
     LIMIT 1`,
    params,
  );
  return (r.rowCount ?? 0) > 0;
}
