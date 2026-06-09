import type { Pool } from "pg";

export type BongsimBuyerSessionIdentity = {
  email: string;
  userId: string;
};

export function bongsimBuyerSessionIdentity(session: {
  user?: { email?: string | null; id?: string } | null;
} | null): BongsimBuyerSessionIdentity {
  return {
    email: session?.user?.email?.trim().toLowerCase() ?? "",
    userId: (session?.user?.id ?? "").trim(),
  };
}

/** 마이페이지 목록·사용량·취소 API 공통 — 구매자 이메일 또는 `consents.bongtour_user_id` */
export async function isBongsimOrderOwnedBySession(
  pool: Pool,
  orderId: string,
  buyer: BongsimBuyerSessionIdentity,
): Promise<boolean> {
  const { email, userId } = buyer;
  if (!email && !userId) return false;

  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bongsim_order o
      WHERE o.order_id = $1::uuid
        AND (
          ($2::text <> '' AND lower(trim(o.buyer_email)) = lower(trim($2)))
          OR ($3::text <> '' AND (o.consents->>'bongtour_user_id') = $3)
        )`,
    [orderId, email, userId],
  );
  return Number.parseInt(r.rows[0]?.n ?? "0", 10) > 0;
}
