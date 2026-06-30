import { randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { supportsUsimFulfillment } from "@/lib/bongsim/catalog/sim-fulfillment";
import type { BongsimOrderV1 } from "@/lib/bongsim/contracts/order.v1";
import { prepareCatalogCheckoutLines } from "@/lib/bongsim/data/checkout-create-order";
import { isValidBuyerPhoneInput, normalizeBuyerPhone } from "@/lib/bongsim/phone/normalize-buyer-phone";

export const OFFLINE_USIM_CHECKOUT_CHANNEL = "admin_offline_usim";
export const OFFLINE_PAYMENT_PROVIDER = "offline";

export type OfflinePaymentChannel = "cash" | "card_terminal" | "bank_transfer";

export type OfflineUsimConsentsV1 = {
  fulfillment: "physical_usim_only";
  created_by_admin_id: string;
  created_at: string;
  payment?: {
    channel: OfflinePaymentChannel;
    confirmed_by_admin_id: string;
    confirmed_at: string;
    note?: string | null;
  };
};

/** REGRESSION-FREEZE[bongsim-offline-usim-order]: 오프라인 USIM 전용 주문·결제 SSOT — manifest */
export function parseOfflineUsimConsents(raw: unknown): OfflineUsimConsentsV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const o = root.offline_usim;
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const row = o as Record<string, unknown>;
  if (row.fulfillment !== "physical_usim_only") return null;
  const created_by_admin_id =
    typeof row.created_by_admin_id === "string" ? row.created_by_admin_id.trim() : "";
  const created_at = typeof row.created_at === "string" ? row.created_at.trim() : "";
  if (!created_by_admin_id || !created_at) return null;
  const paymentRaw = row.payment;
  let payment: OfflineUsimConsentsV1["payment"];
  if (paymentRaw && typeof paymentRaw === "object" && !Array.isArray(paymentRaw)) {
    const p = paymentRaw as Record<string, unknown>;
    const channel = p.channel;
    if (channel === "cash" || channel === "card_terminal" || channel === "bank_transfer") {
      payment = {
        channel,
        confirmed_by_admin_id: String(p.confirmed_by_admin_id ?? ""),
        confirmed_at: String(p.confirmed_at ?? ""),
        note: typeof p.note === "string" ? p.note : null,
      };
    }
  }
  return { fulfillment: "physical_usim_only", created_by_admin_id, created_at, payment };
}

export function isOfflineUsimOnlyOrder(consents: unknown): boolean {
  return parseOfflineUsimConsents(consents) != null;
}

function makeOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = randomBytes(4).toString("hex").toUpperCase();
  return `BS-${day}-${rnd}`;
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

export type AdminCreateOfflineUsimOrderResult =
  | { ok: true; order: BongsimOrderV1["order"] }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "validation"
        | "product_not_found"
        | "product_not_usim_capable"
        | "db_error";
      message: string;
    };

export async function adminCreateOfflineUsimOrder(input: {
  option_api_id: string;
  quantity: number;
  buyer_email: string;
  buyer_phone: string;
  admin_id: string;
  note?: string | null;
}): Promise<AdminCreateOfflineUsimOrderResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured", message: "DB 미연결" };

  const option_api_id = input.option_api_id.trim();
  const buyer_email = normEmail(input.buyer_email);
  const buyer_phone = normalizeBuyerPhone(input.buyer_phone);
  const quantity = Math.trunc(input.quantity);

  if (!option_api_id) {
    return { ok: false, reason: "validation", message: "상품 option_api_id가 필요합니다." };
  }
  if (!buyer_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) {
    return { ok: false, reason: "validation", message: "유효한 이메일을 입력해 주세요." };
  }
  if (!buyer_phone || !isValidBuyerPhoneInput(input.buyer_phone)) {
    return { ok: false, reason: "validation", message: "휴대폰 번호를 010 형식으로 입력해 주세요." };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, reason: "validation", message: "수량은 1~99 사이 정수여야 합니다." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const linePrep = await prepareCatalogCheckoutLines(client, [{ option_api_id, quantity }]);
    if (!linePrep.ok) {
      await client.query("ROLLBACK");
      if (linePrep.reason === "product_not_found") {
        return { ok: false, reason: "product_not_found", message: "상품을 찾을 수 없습니다." };
      }
      return { ok: false, reason: "validation", message: "상품 정보를 확인해 주세요." };
    }
    const prepared = linePrep.prepared;
    const snap = prepared[0]!.snapshot;
    if (!supportsUsimFulfillment(snap.sim_kind)) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "product_not_usim_capable",
        message: "물리 USIM 활성화가 가능한 상품이 아닙니다.",
      };
    }

    const subtotal_krw = prepared.reduce((sum, p) => sum + p.line_total, 0);
    const consentsJson: Record<string, unknown> = {
      terms_version: "admin_offline_usim",
      terms_accepted: true,
      marketing: { accepted: false, version: null },
      offline_usim: {
        fulfillment: "physical_usim_only",
        created_by_admin_id: input.admin_id,
        created_at: new Date().toISOString(),
        ...(input.note?.trim() ? { create_note: input.note.trim() } : {}),
      } satisfies OfflineUsimConsentsV1 & { create_note?: string },
    };

    const orderNumber = makeOrderNumber();
    const idempotency_key = `admin_offline_${randomUUID()}`;
    const ins = await client.query<{ order_id: string }>(
      `INSERT INTO bongsim_order (
        order_number, status, checkout_channel, buyer_email, buyer_tel, buyer_locale,
        idempotency_key, consents, currency, subtotal_krw, discount_krw, tax_krw, grand_total_krw
      ) VALUES ($1, 'awaiting_payment', $2, $3, $4, 'ko', $5, $6::jsonb, 'KRW', $7, 0, 0, $7)
      RETURNING order_id::text AS order_id`,
      [
        orderNumber,
        OFFLINE_USIM_CHECKOUT_CHANNEL,
        buyer_email,
        buyer_phone,
        idempotency_key,
        JSON.stringify(consentsJson),
        subtotal_krw,
      ],
    );
    const orderId = ins.rows[0]?.order_id;
    if (!orderId) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "db_error", message: "주문 저장에 실패했습니다." };
    }

    for (const p of prepared) {
      await client.query(
        `INSERT INTO bongsim_order_line (
          order_id, option_api_id, quantity, charged_unit_price_krw, line_total_krw, charged_basis_key, snapshot
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          orderId,
          p.option_api_id,
          p.quantity,
          p.unit_krw,
          p.line_total,
          p.basis_key,
          JSON.stringify(p.snapshot),
        ],
      );
    }

    await client.query("COMMIT");

    const full = await loadMinimalOrder(pool, orderId);
    if (!full) return { ok: false, reason: "db_error", message: "주문 조회에 실패했습니다." };
    return { ok: true, order: full };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[adminCreateOfflineUsimOrder]", e);
    return { ok: false, reason: "db_error", message: "주문 생성 중 오류가 발생했습니다." };
  } finally {
    client.release();
  }
}

export type AdminConfirmOfflineUsimPaymentResult =
  | { ok: true; order_id: string; order_number: string }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "order_not_found"
        | "not_offline_usim_order"
        | "invalid_status"
        | "validation"
        | "db_error";
      message: string;
    };

export async function adminConfirmOfflineUsimPayment(input: {
  order_id: string;
  payment_channel: OfflinePaymentChannel;
  admin_id: string;
  note?: string | null;
}): Promise<AdminConfirmOfflineUsimPaymentResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured", message: "DB 미연결" };

  const channel = input.payment_channel;
  if (channel !== "cash" && channel !== "card_terminal" && channel !== "bank_transfer") {
    return { ok: false, reason: "validation", message: "결제 수단을 선택해 주세요." };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const o = await client.query<{
      order_id: string;
      order_number: string;
      status: string;
      consents: unknown;
      grand_total_krw: string;
    }>(
      `SELECT order_id::text AS order_id, order_number, status, consents, grand_total_krw::text AS grand_total_krw
         FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [input.order_id],
    );
    const order = o.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_found", message: "주문을 찾을 수 없습니다." };
    }
    const offline = parseOfflineUsimConsents(order.consents);
    if (!offline) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "not_offline_usim_order",
        message: "오프라인 USIM 전용 주문이 아닙니다.",
      };
    }
    if (order.status !== "awaiting_payment") {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "invalid_status",
        message: "결제대기 상태의 주문만 오프라인 결제 확인할 수 있습니다.",
      };
    }

    const grand = Number.parseInt(order.grand_total_krw, 10);
    const paymentRef = `offline_${order.order_number}_${Date.now()}`;
    const consentsRoot =
      order.consents && typeof order.consents === "object" && !Array.isArray(order.consents)
        ? { ...(order.consents as Record<string, unknown>) }
        : {};
    const offlineBlock = { ...offline };
    offlineBlock.payment = {
      channel,
      confirmed_by_admin_id: input.admin_id,
      confirmed_at: new Date().toISOString(),
      note: input.note?.trim() || null,
    };
    consentsRoot.offline_usim = offlineBlock;

    await client.query(
      `UPDATE bongsim_order
          SET status = 'paid',
              paid_at = now(),
              payment_reference = $2,
              paid_amount_krw = $3,
              payment_provider = $4,
              consents = $5::jsonb,
              updated_at = now()
        WHERE order_id = $1::uuid`,
      [
        input.order_id,
        paymentRef,
        grand,
        OFFLINE_PAYMENT_PROVIDER,
        JSON.stringify(consentsRoot),
      ],
    );

    const attemptKey = `offline_confirm_${input.order_id}`;
    await client.query(
      `INSERT INTO bongsim_payment_attempt (
        order_id, idempotency_key, status, provider, provider_session_id, amount_krw, currency
      ) VALUES ($1::uuid, $2, 'captured', $3, $4, $5, 'KRW')
      ON CONFLICT (order_id, idempotency_key) DO NOTHING`,
      [input.order_id, attemptKey, OFFLINE_PAYMENT_PROVIDER, paymentRef, grand],
    );

    await client.query("COMMIT");
    return { ok: true, order_id: order.order_id, order_number: order.order_number };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[adminConfirmOfflineUsimPayment]", e);
    return { ok: false, reason: "db_error", message: "결제 확인 저장 중 오류가 발생했습니다." };
  } finally {
    client.release();
  }
}

async function loadMinimalOrder(
  pool: import("pg").Pool,
  orderId: string,
): Promise<BongsimOrderV1["order"] | null> {
  const o = await pool.query(
    `SELECT order_id::text, order_number, status, checkout_channel, buyer_email, buyer_locale,
            idempotency_key, consents, subtotal_krw::text, discount_krw::text, tax_krw::text,
            grand_total_krw::text, created_at, updated_at
       FROM bongsim_order WHERE order_id = $1::uuid`,
    [orderId],
  );
  const order = o.rows[0];
  if (!order) return null;
  const ls = await pool.query(
    `SELECT line_id::text, option_api_id, quantity, charged_unit_price_krw::text, line_total_krw::text,
            charged_basis_key, snapshot, created_at
       FROM bongsim_order_line WHERE order_id = $1::uuid ORDER BY created_at ASC`,
    [orderId],
  );
  return {
    order_id: order.order_id,
    order_number: order.order_number,
    status: order.status,
    created_at: new Date(order.created_at).toISOString(),
    updated_at: new Date(order.updated_at).toISOString(),
    checkout_channel: order.checkout_channel,
    buyer: {
      email: order.buyer_email,
      locale: order.buyer_locale === "en" ? "en" : order.buyer_locale === "ko" ? "ko" : null,
    },
    consents: {
      terms_version: "",
      terms_accepted: true,
      marketing: { accepted: false, version: null },
    },
    idempotency_key: order.idempotency_key,
    totals: {
      currency: "KRW",
      subtotal_krw: Number.parseInt(order.subtotal_krw, 10),
      discount_krw: Number.parseInt(order.discount_krw, 10),
      tax_krw: Number.parseInt(order.tax_krw, 10),
      grand_total_krw: Number.parseInt(order.grand_total_krw, 10),
    },
    payment: {
      payment_status: "unpaid",
      payment_provider: null,
      payment_reference: null,
      paid_amount_krw: 0,
      paid_currency: "KRW",
      paid_at: null,
      failure: { code: null, message: null },
    },
    fulfillment: {
      fulfillment_status: "not_started",
      supplier_submission_id: null,
      supplier_ids: { profile: null, iccid: null, other: {} },
      attempt_count: 0,
      last_error: { code: null, at: null },
      delivered_at: null,
      audit: { payload_out_ref: null, payload_in_last_ref: null },
    },
    lines: ls.rows.map((row) => ({
      line_id: row.line_id,
      option_api_id: row.option_api_id,
      quantity: row.quantity,
      charged_unit_price_krw: Number.parseInt(row.charged_unit_price_krw, 10),
      line_total_krw: Number.parseInt(row.line_total_krw, 10),
      charged_basis_key: row.charged_basis_key,
      snapshot: row.snapshot as BongsimOrderV1["order"]["lines"][0]["snapshot"],
    })),
  };
}
