import type { PoolClient } from "pg";
import type { BongsimProductOptionDbRow } from "@/lib/bongsim/data/bongsim-product-option-db-row";
import { mapDbRowToProductOptionV1 } from "@/lib/bongsim/data/map-row-to-product-option-v1";
import { selectChargedUnitPriceKrw } from "@/lib/bongsim/data/pricing-select-charged";

export type BongsimCouponDbRow = {
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
};

function toInt(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === "string" ? Number.parseInt(v, 10) : Math.trunc(Number(v));
}

/** 권장가 기준 소계(라인 합계). */
export async function bongsimCheckoutSubtotalKrw(
  client: Pick<PoolClient, "query">,
  option_api_id: string,
  quantity: number,
): Promise<{ ok: true; subtotal_krw: number } | { ok: false; error: string }> {
  const pr = await client.query<BongsimProductOptionDbRow>(
    `SELECT * FROM bongsim_product_option WHERE option_api_id = $1 LIMIT 1`,
    [option_api_id],
  );
  if (!pr.rows[0]) return { ok: false, error: "상품을 찾을 수 없습니다." };
  const opt = mapDbRowToProductOptionV1(pr.rows[0]);
  const { unit_krw } = selectChargedUnitPriceKrw(opt.price_block);
  if (!Number.isFinite(unit_krw) || unit_krw <= 0) return { ok: false, error: "상품 가격을 확인할 수 없습니다." };
  const q = Math.trunc(quantity);
  return { ok: true, subtotal_krw: unit_krw * q };
}

export function computeBongsimCouponDiscountKrw(subtotalKrw: number, row: BongsimCouponDbRow): number {
  const sub = Math.max(0, Math.trunc(subtotalKrw));
  const dtype = String(row.discount_type).trim().toLowerCase();
  const dv = Number(row.discount_value);
  if (!Number.isFinite(dv) || dv < 0) return 0;
  let disc = 0;
  if (dtype === "fixed") {
    disc = Math.min(Math.floor(dv), sub);
  } else if (dtype === "percent") {
    disc = Math.floor((sub * dv) / 100);
    const capRaw = row.max_discount_krw;
    if (capRaw != null && String(capRaw).trim() !== "") {
      const cap = Math.trunc(Number(capRaw));
      if (Number.isFinite(cap) && cap >= 0) disc = Math.min(disc, cap);
    }
  } else {
    return 0;
  }
  return Math.min(Math.max(0, disc), sub);
}

function couponTimeOk(row: BongsimCouponDbRow, now: Date): { ok: true } | { ok: false; error: string } {
  const vf = row.valid_from instanceof Date ? row.valid_from : new Date(row.valid_from);
  const vu = row.valid_until instanceof Date ? row.valid_until : new Date(row.valid_until);
  if (now < vf) return { ok: false, error: "아직 사용 가능 기간이 아닙니다." };
  if (now > vu) return { ok: false, error: "만료된 쿠폰입니다." };
  return { ok: true };
}

function usageOk(row: BongsimCouponDbRow): { ok: true } | { ok: false; error: string } {
  const limitRaw = row.usage_limit;
  if (limitRaw == null || String(limitRaw).trim() === "") return { ok: true };
  const limit = toInt(limitRaw as string | number);
  if (!Number.isFinite(limit) || limit <= 0) return { ok: true };
  const used = toInt(row.used_count);
  if (used >= limit) return { ok: false, error: "사용 한도를 초과했습니다." };
  return { ok: true };
}

function minOrderOk(subtotal: number, row: BongsimCouponDbRow): { ok: true } | { ok: false; error: string } {
  const minRaw = row.min_order_krw;
  if (minRaw == null || String(minRaw).trim() === "") return { ok: true };
  const min = toInt(minRaw as string | number);
  if (!Number.isFinite(min) || min <= 0) return { ok: true };
  if (subtotal < min) return { ok: false, error: "최소 주문 금액 미만입니다." };
  return { ok: true };
}

export async function loadBongsimCouponByCode(
  client: Pick<PoolClient, "query">,
  code: string,
): Promise<BongsimCouponDbRow | null> {
  const r = await client.query<BongsimCouponDbRow>(
    `SELECT coupon_id, code, description, discount_type, discount_value::text AS discount_value,
            max_discount_krw::text AS max_discount_krw, min_order_krw::text AS min_order_krw,
            usage_limit, used_count, valid_from, valid_until, is_active
     FROM bongsim_coupon
     WHERE lower(trim(code)) = lower(trim($1))
     LIMIT 1`,
    [code],
  );
  return r.rows[0] ?? null;
}

export async function loadBongsimCouponByIdForUpdate(
  client: PoolClient,
  couponId: string,
): Promise<BongsimCouponDbRow | null> {
  const r = await client.query<BongsimCouponDbRow>(
    `SELECT coupon_id, code, description, discount_type, discount_value::text AS discount_value,
            max_discount_krw::text AS max_discount_krw, min_order_krw::text AS min_order_krw,
            usage_limit, used_count, valid_from, valid_until, is_active
     FROM bongsim_coupon
     WHERE coupon_id = $1::uuid
     FOR UPDATE`,
    [couponId],
  );
  return r.rows[0] ?? null;
}

export type ValidateCouponInput = {
  code: string;
  option_api_id: string;
  quantity: number;
};

export async function validateBongsimCouponForDisplay(
  client: Pick<PoolClient, "query">,
  input: ValidateCouponInput,
  now = new Date(),
): Promise<
  | { ok: true; coupon_id: string; description: string | null; discount_krw: number; subtotal_krw: number }
  | { ok: false; error: string }
> {
  const code = input.code.trim();
  if (!code) return { ok: false, error: "쿠폰 코드를 입력해 주세요." };
  const st = await bongsimCheckoutSubtotalKrw(client, input.option_api_id, input.quantity);
  if (!st.ok) return st;
  const row = await loadBongsimCouponByCode(client, code);
  if (!row) return { ok: false, error: "쿠폰을 찾을 수 없습니다." };
  if (!row.is_active) return { ok: false, error: "비활성 쿠폰입니다." };
  const t = couponTimeOk(row, now);
  if (!t.ok) return t;
  const u = usageOk(row);
  if (!u.ok) return u;
  const m = minOrderOk(st.subtotal_krw, row);
  if (!m.ok) return m;
  const disc = computeBongsimCouponDiscountKrw(st.subtotal_krw, row);
  if (disc <= 0) return { ok: false, error: "이 주문에는 적용할 할인이 없습니다." };
  return {
    ok: true,
    coupon_id: row.coupon_id,
    description: row.description,
    discount_krw: disc,
    subtotal_krw: st.subtotal_krw,
  };
}

export async function assertBongsimCouponForOrderInsert(
  client: PoolClient,
  input: {
    coupon_id: string;
    client_discount_krw: number;
    option_api_id: string;
    quantity: number;
  },
  now = new Date(),
): Promise<
  | { ok: true; coupon: BongsimCouponDbRow; subtotal_krw: number; discount_krw: number }
  | { ok: false; error: string }
> {
  const row = await loadBongsimCouponByIdForUpdate(client, input.coupon_id);
  if (!row) return { ok: false, error: "쿠폰이 유효하지 않습니다." };
  if (!row.is_active) return { ok: false, error: "비활성 쿠폰입니다." };
  const t = couponTimeOk(row, now);
  if (!t.ok) return t;
  const u = usageOk(row);
  if (!u.ok) return u;
  const st = await bongsimCheckoutSubtotalKrw(client, input.option_api_id, input.quantity);
  if (!st.ok) return st;
  const m = minOrderOk(st.subtotal_krw, row);
  if (!m.ok) return m;
  const disc = computeBongsimCouponDiscountKrw(st.subtotal_krw, row);
  if (disc <= 0) return { ok: false, error: "이 주문에는 적용할 할인이 없습니다." };
  if (disc !== Math.trunc(input.client_discount_krw)) {
    return { ok: false, error: "쿠폰 할인 금액이 변경되었습니다. 다시 적용해 주세요." };
  }
  return { ok: true, coupon: row, subtotal_krw: st.subtotal_krw, discount_krw: disc };
}

export function parseCouponMetaFromOrderConsents(raw: unknown): {
  coupon_id: string | null;
  coupon_discount_krw: number;
} {
  if (!raw || typeof raw !== "object") return { coupon_id: null, coupon_discount_krw: 0 };
  const o = raw as Record<string, unknown>;
  const id = typeof o.coupon_id === "string" ? o.coupon_id.trim() : "";
  const dRaw = o.coupon_discount_krw;
  const d =
    typeof dRaw === "number" && Number.isFinite(dRaw)
      ? Math.trunc(dRaw)
      : typeof dRaw === "string"
        ? Number.parseInt(dRaw, 10)
        : 0;
  return { coupon_id: id || null, coupon_discount_krw: Number.isFinite(d) && d > 0 ? d : 0 };
}

/**
 * 결제 캡처 직후 동일 트랜잭션에서 호출. `bongsim_coupon_usage` 1건 + `used_count` 증가(멱등).
 */
export async function recordBongsimCouponUsageAfterCapture(client: PoolClient, orderId: string): Promise<void> {
  const o = await client.query<{ consents: unknown; subtotal_krw: string; discount_krw: string; grand_total_krw: string }>(
    `SELECT consents, subtotal_krw, discount_krw, grand_total_krw FROM bongsim_order WHERE order_id = $1::uuid`,
    [orderId],
  );
  const row = o.rows[0];
  if (!row) return;
  const meta = parseCouponMetaFromOrderConsents(row.consents);
  if (!meta.coupon_id || meta.coupon_discount_krw <= 0) return;

  const sub = toInt(row.subtotal_krw);
  const disc = toInt(row.discount_krw);
  const grand = toInt(row.grand_total_krw);
  if (disc !== meta.coupon_discount_krw) return;

  const exists = await client.query<{ ok: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM bongsim_coupon_usage WHERE order_id = $1::uuid) AS ok`,
    [orderId],
  );
  if (exists.rows[0]?.ok) return;

  await client.query(
    `INSERT INTO bongsim_coupon_usage (
       usage_id, coupon_id, order_id, user_id, original_amount_krw, discount_amount_krw, final_amount_krw, used_at
     ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, NULL, $3, $4, $5, now())`,
    [meta.coupon_id, orderId, sub, disc, grand],
  );

  await client.query(`UPDATE bongsim_coupon SET used_count = used_count + 1 WHERE coupon_id = $1::uuid`, [meta.coupon_id]);
}

export type ApplyCouponUsageBody = {
  coupon_id: string;
  order_id: string;
  original_amount_krw: number;
  discount_amount_krw: number;
  final_amount_krw: number;
  user_id?: string | null;
};

export async function applyBongsimCouponUsageTransaction(
  pool: import("pg").Pool,
  body: ApplyCouponUsageBody,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const couponId = body.coupon_id?.trim();
  const orderId = body.order_id?.trim();
  if (!couponId || !orderId) return { ok: false, error: "필수 값이 없습니다." };
  const oa = Math.trunc(body.original_amount_krw);
  const da = Math.trunc(body.discount_amount_krw);
  const fa = Math.trunc(body.final_amount_krw);
  if (!Number.isFinite(oa) || !Number.isFinite(da) || !Number.isFinite(fa) || oa < 0 || da < 0 || fa < 0) {
    return { ok: false, error: "금액이 올바르지 않습니다." };
  }
  if (oa - da !== fa) return { ok: false, error: "금액 합계가 맞지 않습니다." };

  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const ord = await c.query<{
      subtotal_krw: string;
      discount_krw: string;
      grand_total_krw: string;
      status: string;
      consents: unknown;
    }>(
      `SELECT subtotal_krw, discount_krw, grand_total_krw, status, consents FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [orderId],
    );
    const orow = ord.rows[0];
    if (!orow) {
      await c.query("ROLLBACK");
      return { ok: false, error: "주문을 찾을 수 없습니다." };
    }
    if (orow.status !== "paid") {
      await c.query("ROLLBACK");
      return { ok: false, error: "결제 완료된 주문만 기록할 수 있습니다." };
    }
    if (toInt(orow.subtotal_krw) !== oa || toInt(orow.discount_krw) !== da || toInt(orow.grand_total_krw) !== fa) {
      await c.query("ROLLBACK");
      return { ok: false, error: "주문 금액과 일치하지 않습니다." };
    }
    const meta = parseCouponMetaFromOrderConsents(orow.consents);
    if (meta.coupon_id !== couponId || meta.coupon_discount_krw !== da) {
      await c.query("ROLLBACK");
      return { ok: false, error: "주문에 적용된 쿠폰과 일치하지 않습니다." };
    }

    const dup = await c.query(`SELECT 1 FROM bongsim_coupon_usage WHERE order_id = $1::uuid LIMIT 1`, [orderId]);
    if (dup.rows[0]) {
      await c.query("ROLLBACK");
      return { ok: false, error: "이미 쿠폰 사용이 기록된 주문입니다." };
    }

    const uid = body.user_id?.trim() || null;
    await c.query(
      `INSERT INTO bongsim_coupon_usage (
         usage_id, coupon_id, order_id, user_id, original_amount_krw, discount_amount_krw, final_amount_krw, used_at
       ) VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3, $4, $5, $6, now())`,
      [couponId, orderId, uid, oa, da, fa],
    );

    await c.query(`UPDATE bongsim_coupon SET used_count = used_count + 1 WHERE coupon_id = $1::uuid`, [couponId]);
    await c.query("COMMIT");
    return { ok: true };
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    const err = e as { code?: string; message?: string };
    if (err.code === "23503") return { ok: false, error: "쿠폰 또는 주문을 찾을 수 없습니다." };
    return { ok: false, error: err.message ?? "저장에 실패했습니다." };
  } finally {
    c.release();
  }
}
