import type { PoolClient } from "pg";
import type { BongsimCouponDbRow } from "@/lib/bongsim/data/bongsim-coupon";
import { bongsimCheckoutSubtotalKrw, computeBongsimCouponDiscountKrw } from "@/lib/bongsim/data/bongsim-coupon";
import { computeExpiresAt, getTemplateBySlot, type IssuanceSlot } from "@/lib/coupon/issuance-helpers";

export type IssueUserCouponParams = {
  userId: string;
  userEmail: string;
  slot: IssuanceSlot;
  issuedForPeriod?: string | null;
  notes?: string | null;
  /** admin_manual 전용: 발급에 사용할 `bongsim_coupon.coupon_id` (UUID) */
  sourceCouponIdOverride?: string | null;
};

export type UserCouponListRow = {
  user_coupon_id: string;
  template_label: string | null;
  discount_type: string;
  discount_value: string;
  max_discount_krw: string | null;
  min_order_krw: string | null;
  expires_at: Date | null;
  status: string;
  used_at: Date | null;
};

function toInt(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? Number.parseInt(v, 10) : Math.trunc(Number(v));
}

function minOrderOk(subtotal: number, row: BongsimCouponDbRow): { ok: true } | { ok: false; error: string } {
  const minRaw = row.min_order_krw;
  if (minRaw == null || String(minRaw).trim() === "") return { ok: true };
  const min = toInt(minRaw as string | number);
  if (!Number.isFinite(min) || min <= 0) return { ok: true };
  if (subtotal < min) return { ok: false, error: "최소 주문 금액 미만입니다." };
  return { ok: true };
}

function userCouponTimeOk(expiresAt: Date | null, now: Date): { ok: true } | { ok: false; error: string } {
  if (!expiresAt) return { ok: true };
  if (now > expiresAt) return { ok: false, error: "만료된 쿠폰입니다." };
  return { ok: true };
}

export async function issueUserCoupon(
  client: Pick<PoolClient, "query">,
  params: IssueUserCouponParams,
  now = new Date(),
): Promise<{ issued: boolean; userCouponId?: string; expiresAt?: Date | null }> {
  const userId = params.userId.trim();
  const userEmail = params.userEmail.trim().toLowerCase();
  if (!userId || !userEmail) return { issued: false };

  let sourceId: string;
  let tplRow: BongsimCouponDbRow & { template_validity_days: number | null };
  if (params.slot === "admin_manual") {
    const ov = params.sourceCouponIdOverride?.trim();
    if (!ov) throw new Error("admin_manual_requires_sourceCouponIdOverride");
    const r = await client.query<BongsimCouponDbRow & { template_validity_days: number | null }>(
      `SELECT coupon_id, code, description, discount_type, discount_value::text AS discount_value,
              max_discount_krw::text AS max_discount_krw, min_order_krw::text AS min_order_krw,
              usage_limit, used_count, valid_from, valid_until, is_active,
              template_validity_days
       FROM bongsim_coupon WHERE coupon_id = $1::uuid LIMIT 1`,
      [ov],
    );
    const row = r.rows[0];
    if (!row) return { issued: false };
    sourceId = row.coupon_id;
    tplRow = row;
  } else {
    const tpl = await getTemplateBySlot(client, params.slot);
    if (!tpl) return { issued: false };
    sourceId = tpl.coupon_id;
    tplRow = tpl;
  }

  const expiresAt = computeExpiresAt(tplRow, now);
  const issuedVia = params.slot;
  const notes = params.notes ?? null;
  const period = params.issuedForPeriod ?? null;

  let existsClause = "FALSE";
  const qargs: unknown[] = [userId, userEmail, sourceId, expiresAt, notes, period];
  if (params.slot === "welcome") {
    existsClause = `EXISTS (SELECT 1 FROM bongsim_user_coupon x WHERE x.user_id = $1::text AND x.issued_via = 'welcome')`;
  } else if (params.slot === "referral_invitee") {
    existsClause = `EXISTS (SELECT 1 FROM bongsim_user_coupon x WHERE x.user_id = $1::text AND x.issued_via = 'referral_invitee')`;
  } else if (params.slot === "review" && notes) {
    existsClause = `EXISTS (SELECT 1 FROM bongsim_user_coupon x WHERE x.user_id = $1::text AND x.issued_via = 'review' AND x.notes IS NOT DISTINCT FROM $5::text)`;
  }

  const ins = await client.query<{ user_coupon_id: string; expires_at: Date | null }>(
    `INSERT INTO bongsim_user_coupon (
       user_id, user_email, source_coupon_id, issued_via, issued_at, expires_at, status, notes, issued_for_period
     )
     SELECT $1::text, $2::text, $3::uuid, $7::text, now(), $4::timestamptz, 'active', $5::text, $6::text
     WHERE NOT (${existsClause})
     RETURNING user_coupon_id::text, expires_at`,
    [...qargs, issuedVia],
  );
  const row = ins.rows[0];
  if (!row) return { issued: false };
  return { issued: true, userCouponId: row.user_coupon_id, expiresAt: row.expires_at };
}

export async function listUserCoupons(
  client: Pick<PoolClient, "query">,
  userId: string,
  now = new Date(),
): Promise<{ active: UserCouponListRow[]; used: UserCouponListRow[]; expired: UserCouponListRow[] }> {
  const uid = userId.trim();
  const base = `
    SELECT
      uc.user_coupon_id::text AS user_coupon_id,
      COALESCE(c.template_label, c.description) AS template_label,
      c.discount_type,
      c.discount_value::text AS discount_value,
      c.max_discount_krw::text AS max_discount_krw,
      c.min_order_krw::text AS min_order_krw,
      uc.expires_at,
      uc.status,
      uc.used_at
    FROM bongsim_user_coupon uc
    JOIN bongsim_coupon c ON c.coupon_id = uc.source_coupon_id
    WHERE uc.user_id = $1::text
    ORDER BY uc.issued_at DESC
  `;
  const r = await client.query<UserCouponListRow>(base, [uid]);
  const active: UserCouponListRow[] = [];
  const used: UserCouponListRow[] = [];
  const expired: UserCouponListRow[] = [];
  for (const row of r.rows) {
    if (row.status === "used") {
      used.push(row);
      continue;
    }
    if (row.status === "expired" || row.status === "revoked") {
      expired.push(row);
      continue;
    }
    if (row.status === "active") {
      if (row.expires_at && now > new Date(row.expires_at)) {
        expired.push(row);
      } else {
        active.push(row);
      }
    }
  }
  return { active, used, expired };
}

export async function validateUserCoupon(
  client: Pick<PoolClient, "query">,
  userCouponId: string,
  userId: string,
  subtotalKrw: number,
  now = new Date(),
): Promise<
  | {
      ok: true;
      discount_krw: number;
      user_coupon_id: string;
      description: string | null;
      subtotal_krw: number;
    }
  | { ok: false; error: string }
> {
  const id = userCouponId.trim();
  const uid = userId.trim();
  if (!id || !uid) return { ok: false, error: "쿠폰 정보가 올바르지 않습니다." };

  const r = await client.query<{
    user_coupon_id: string;
    uc_status: string;
    expires_at: Date | null;
    coupon_id: string;
    code: string;
    description: string | null;
    discount_type: string;
    discount_value: string;
    max_discount_krw: string | null;
    min_order_krw: string | null;
    usage_limit: string | number | null;
    used_count: string | number;
    valid_from: Date;
    valid_until: Date;
    is_active: boolean;
  }>(
    `SELECT uc.user_coupon_id::text AS user_coupon_id, uc.status AS uc_status, uc.expires_at,
            c.coupon_id, c.code, c.description, c.discount_type, c.discount_value::text AS discount_value,
            c.max_discount_krw::text AS max_discount_krw, c.min_order_krw::text AS min_order_krw,
            c.usage_limit, c.used_count, c.valid_from, c.valid_until, c.is_active
     FROM bongsim_user_coupon uc
     JOIN bongsim_coupon c ON c.coupon_id = uc.source_coupon_id
     WHERE uc.user_coupon_id = $1::uuid AND uc.user_id = $2::text
     LIMIT 1`,
    [id, uid],
  );
  const row = r.rows[0];
  if (!row) return { ok: false, error: "쿠폰을 찾을 수 없습니다." };
  if (row.uc_status !== "active") return { ok: false, error: "사용할 수 없는 쿠폰입니다." };
  const t = userCouponTimeOk(row.expires_at, now);
  if (!t.ok) return t;
  if (!row.is_active) return { ok: false, error: "비활성 쿠폰입니다." };

  const tpl: BongsimCouponDbRow = {
    coupon_id: row.coupon_id,
    code: row.code,
    description: row.description,
    discount_type: row.discount_type,
    discount_value: row.discount_value,
    max_discount_krw: row.max_discount_krw,
    min_order_krw: row.min_order_krw,
    usage_limit: row.usage_limit,
    used_count: row.used_count,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    is_active: row.is_active,
  };

  const sub = Math.max(0, Math.trunc(subtotalKrw));
  const m = minOrderOk(sub, tpl);
  if (!m.ok) return m;
  const disc = computeBongsimCouponDiscountKrw(sub, tpl);
  if (disc <= 0) return { ok: false, error: "이 주문에는 적용할 할인이 없습니다." };
  return {
    ok: true,
    discount_krw: disc,
    user_coupon_id: row.user_coupon_id,
    description: row.description,
    subtotal_krw: sub,
  };
}

export async function validateUserCouponForOrderInsert(
  client: Pick<PoolClient, "query">,
  input: { user_coupon_id: string; user_id: string; client_discount_krw: number; option_api_id: string; quantity: number },
  now = new Date(),
): Promise<{ ok: true; discount_krw: number } | { ok: false; error: string }> {
  const st = await bongsimCheckoutSubtotalKrw(client, input.option_api_id, input.quantity);
  if (!st.ok) return st;
  const v = await validateUserCoupon(client, input.user_coupon_id, input.user_id, st.subtotal_krw, now);
  if (!v.ok) return v;
  if (v.discount_krw !== Math.trunc(input.client_discount_krw)) {
    return { ok: false, error: "쿠폰 할인 금액이 변경되었습니다. 다시 적용해 주세요." };
  }
  return { ok: true, discount_krw: v.discount_krw };
}

export async function markUserCouponUsed(
  client: Pick<PoolClient, "query">,
  userCouponId: string,
  orderId: string,
  discountKrw: number,
): Promise<void> {
  await client.query(
    `UPDATE bongsim_user_coupon
     SET status = 'used', used_at = now(), used_order_id = $2::uuid, used_amount_krw = $3, updated_at = now()
     WHERE user_coupon_id = $1::uuid AND status = 'active'`,
    [userCouponId.trim(), orderId.trim(), Math.trunc(discountKrw)],
  );
}

export async function markUserCouponExpired(client: Pick<PoolClient, "query">, userCouponId: string): Promise<void> {
  await client.query(
    `UPDATE bongsim_user_coupon SET status = 'expired', updated_at = now() WHERE user_coupon_id = $1::uuid AND status = 'active'`,
    [userCouponId.trim()],
  );
}

export async function revokeUserCoupon(client: Pick<PoolClient, "query">, userCouponId: string, reason: string): Promise<void> {
  await client.query(
    `UPDATE bongsim_user_coupon
     SET status = 'revoked', notes = COALESCE(notes,'') || E'\\n[revoked] ' || $2::text, updated_at = now()
     WHERE user_coupon_id = $1::uuid`,
    [userCouponId.trim(), reason.slice(0, 500)],
  );
}

export async function findReviewRewardForReviewId(
  client: Pick<PoolClient, "query">,
  userId: string,
  reviewId: string,
): Promise<boolean> {
  const note = `review_id:${reviewId.trim()}`;
  const r = await client.query<{ ok: boolean }>(
    `SELECT EXISTS(
       SELECT 1 FROM bongsim_user_coupon
       WHERE user_id = $1::text AND issued_via = 'review' AND notes = $2::text
     ) AS ok`,
    [userId.trim(), note],
  );
  return Boolean(r.rows[0]?.ok);
}
