import { randomBytes, randomUUID } from "node:crypto";
import { isEsimCapableSimKind } from "@/lib/bongsim/catalog/active-product-sql";
import type { BongsimOrderV1 } from "@/lib/bongsim/contracts/order.v1";
import { prepareCatalogCheckoutLines } from "@/lib/bongsim/data/checkout-create-order";
import { drainOrderPaidOutboxBestEffort } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isValidBuyerPhoneInput, normalizeBuyerPhone } from "@/lib/bongsim/phone/normalize-buyer-phone";

export const COMPLIMENTARY_ESIM_CHECKOUT_CHANNEL = "admin_complimentary_esim";
export const COMPLIMENTARY_ESIM_PAYMENT_PROVIDER = "complimentary";

export const COMPLIMENTARY_ESIM_REASON_CATEGORIES = [
  "group_benefit",
  "cs_compensation",
  "customer_thanks",
  "promo_event",
  "other",
] as const;

export type ComplimentaryEsimReasonCategory = (typeof COMPLIMENTARY_ESIM_REASON_CATEGORIES)[number];

export const COMPLIMENTARY_ESIM_REASON_LABELS: Record<ComplimentaryEsimReasonCategory, string> = {
  group_benefit: "단체 혜택",
  cs_compensation: "CS 보상",
  customer_thanks: "고객 감사",
  promo_event: "프로모션·이벤트",
  other: "기타",
};

export type ComplimentaryEsimConsentsV1 = {
  fulfillment: "complimentary_esim";
  created_by_admin_id: string;
  created_at: string;
  reason_category: ComplimentaryEsimReasonCategory;
  reason_memo: string;
  granted_at: string;
  granted_by_admin_id: string;
};

/** REGRESSION-FREEZE[bongsim-complimentary-esim-grant]: 관리자 무상 eSIM — 0원 paid·OrderPaid outbox·QR 알림톡 SSOT — manifest */
export function parseComplimentaryEsimReasonCategory(raw: unknown): ComplimentaryEsimReasonCategory | null {
  if (typeof raw !== "string") return null;
  const lc = raw.trim() as ComplimentaryEsimReasonCategory;
  return (COMPLIMENTARY_ESIM_REASON_CATEGORIES as readonly string[]).includes(lc) ? lc : null;
}

export function parseComplimentaryEsimConsents(raw: unknown): ComplimentaryEsimConsentsV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const root = raw as Record<string, unknown>;
  const o = root.complimentary_esim;
  if (!o || typeof o !== "object" || Array.isArray(o)) return null;
  const row = o as Record<string, unknown>;
  if (row.fulfillment !== "complimentary_esim") return null;
  const created_by_admin_id =
    typeof row.created_by_admin_id === "string" ? row.created_by_admin_id.trim() : "";
  const created_at = typeof row.created_at === "string" ? row.created_at.trim() : "";
  const granted_by_admin_id =
    typeof row.granted_by_admin_id === "string" ? row.granted_by_admin_id.trim() : "";
  const granted_at = typeof row.granted_at === "string" ? row.granted_at.trim() : "";
  const reason_category = parseComplimentaryEsimReasonCategory(row.reason_category);
  const reason_memo = typeof row.reason_memo === "string" ? row.reason_memo.trim() : "";
  if (!created_by_admin_id || !created_at || !granted_by_admin_id || !granted_at) return null;
  if (!reason_category || !reason_memo) return null;
  return {
    fulfillment: "complimentary_esim",
    created_by_admin_id,
    created_at,
    reason_category,
    reason_memo,
    granted_at,
    granted_by_admin_id,
  };
}

export function isComplimentaryEsimOrder(consents: unknown): boolean {
  return parseComplimentaryEsimConsents(consents) != null;
}

function makeOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = randomBytes(4).toString("hex").toUpperCase();
  return `BS-${day}-${rnd}`;
}

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function fallbackComplimentaryEmail(phoneDigits: string): string {
  const digits = phoneDigits.replace(/\D/g, "") || "unknown";
  return `esim-grant+${digits}@bongtour.local`;
}

export type AdminGrantComplimentaryEsimResult =
  | { ok: true; order: BongsimOrderV1["order"]; fulfillment_started: boolean }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "validation"
        | "product_not_found"
        | "product_not_esim_capable"
        | "db_error";
      message: string;
    };

/** REGRESSION-FREEZE[bongsim-complimentary-esim-bulk]: 관리자 무상 eSIM 단체 일괄 — 휴대폰 목록·1인1주문 SSOT — manifest */
export const COMPLIMENTARY_ESIM_BULK_MAX_RECIPIENTS = 100;

const BULK_PHONE_SPLIT_RE = /\r?\n|[,;\t]+/;

/** 텍스트·배열에서 휴대폰 추출 — 중복 제거, 유효/무효 분리 */
export function parseComplimentaryEsimBulkPhones(raw: string | string[]): {
  phones: string[];
  invalid: string[];
} {
  const chunks = Array.isArray(raw)
    ? raw.flatMap((line) => String(line).split(BULK_PHONE_SPLIT_RE))
    : raw.split(BULK_PHONE_SPLIT_RE);
  const phones: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;
    if (!isValidBuyerPhoneInput(trimmed)) {
      invalid.push(trimmed);
      continue;
    }
    const normalized = normalizeBuyerPhone(trimmed)!;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    phones.push(trimmed);
  }
  return { phones, invalid };
}

export type AdminGrantComplimentaryEsimBulkResult =
  | {
      ok: true;
      requested: number;
      succeeded: number;
      failed: number;
      invalid_phones: string[];
      results: Array<
        | {
            phone: string;
            ok: true;
            order_id: string;
            order_number: string;
            fulfillment_started: boolean;
          }
        | { phone: string; ok: false; reason: string; message: string }
      >;
    }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "validation"
        | "product_not_found"
        | "product_not_esim_capable"
        | "db_error";
      message: string;
      invalid_phones?: string[];
    };

export async function adminGrantComplimentaryEsimBulk(input: {
  option_api_id: string;
  reason_category: string;
  reason_memo: string;
  admin_id: string;
  phones: string | string[];
}): Promise<AdminGrantComplimentaryEsimBulkResult> {
  const option_api_id = input.option_api_id.trim();
  const reason_memo = input.reason_memo.trim();
  const reason_category = parseComplimentaryEsimReasonCategory(input.reason_category);
  const { phones, invalid } = parseComplimentaryEsimBulkPhones(input.phones);

  if (!option_api_id) {
    return { ok: false, reason: "validation", message: "상품을 선택해 주세요.", invalid_phones: invalid };
  }
  if (!reason_category) {
    return { ok: false, reason: "validation", message: "무상 발급 사유 유형을 선택해 주세요.", invalid_phones: invalid };
  }
  if (!reason_memo || reason_memo.length < 2) {
    return { ok: false, reason: "validation", message: "무상 발급 사유 메모를 입력해 주세요.", invalid_phones: invalid };
  }
  if (phones.length === 0) {
    return {
      ok: false,
      reason: "validation",
      message: invalid.length > 0 ? "유효한 휴대폰 번호가 없습니다." : "휴대폰 번호를 1건 이상 입력해 주세요.",
      invalid_phones: invalid,
    };
  }
  if (phones.length > COMPLIMENTARY_ESIM_BULK_MAX_RECIPIENTS) {
    return {
      ok: false,
      reason: "validation",
      message: `한 번에 최대 ${COMPLIMENTARY_ESIM_BULK_MAX_RECIPIENTS}명까지 발급할 수 있습니다.`,
      invalid_phones: invalid,
    };
  }

  const results: Array<
    | {
        phone: string;
        ok: true;
        order_id: string;
        order_number: string;
        fulfillment_started: boolean;
      }
    | { phone: string; ok: false; reason: string; message: string }
  > = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < phones.length; i++) {
    const phone = phones[i]!;
    const result = await adminGrantComplimentaryEsim({
      option_api_id,
      quantity: 1,
      buyer_phone: phone,
      reason_category,
      reason_memo,
      admin_id: input.admin_id,
      skip_outbox_drain: i < phones.length - 1,
    });
    if (!result.ok) {
      if (
        i === 0 &&
        (result.reason === "db_unconfigured" ||
          result.reason === "product_not_found" ||
          result.reason === "product_not_esim_capable" ||
          result.reason === "db_error")
      ) {
        return { ok: false, reason: result.reason, message: result.message, invalid_phones: invalid };
      }
      failed += 1;
      results.push({ phone, ok: false, reason: result.reason, message: result.message });
      continue;
    }
    succeeded += 1;
    results.push({
      phone,
      ok: true,
      order_id: result.order.order_id,
      order_number: result.order.order_number,
      fulfillment_started: result.fulfillment_started,
    });
  }

  return {
    ok: true,
    requested: phones.length,
    succeeded,
    failed,
    invalid_phones: invalid,
    results,
  };
}

export async function adminGrantComplimentaryEsim(input: {
  option_api_id: string;
  quantity: number;
  buyer_phone: string;
  buyer_email?: string | null;
  reason_category: string;
  reason_memo: string;
  admin_id: string;
  skip_outbox_drain?: boolean;
}): Promise<AdminGrantComplimentaryEsimResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured", message: "DB 미연결" };

  const option_api_id = input.option_api_id.trim();
  const buyer_phone = normalizeBuyerPhone(input.buyer_phone);
  const quantity = Math.trunc(input.quantity);
  const reason_category = parseComplimentaryEsimReasonCategory(input.reason_category);
  const reason_memo = input.reason_memo.trim();

  if (!option_api_id) {
    return { ok: false, reason: "validation", message: "상품을 선택해 주세요." };
  }
  if (!buyer_phone || !isValidBuyerPhoneInput(input.buyer_phone)) {
    return { ok: false, reason: "validation", message: "휴대폰 번호를 010 형식으로 입력해 주세요." };
  }
  if (!reason_category) {
    return { ok: false, reason: "validation", message: "무상 발급 사유 유형을 선택해 주세요." };
  }
  if (!reason_memo || reason_memo.length < 2) {
    return { ok: false, reason: "validation", message: "무상 발급 사유 메모를 입력해 주세요." };
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
    return { ok: false, reason: "validation", message: "수량은 1~99 사이 정수여야 합니다." };
  }

  const emailRaw = typeof input.buyer_email === "string" ? normEmail(input.buyer_email) : "";
  const buyer_email =
    emailRaw && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
      ? emailRaw
      : fallbackComplimentaryEmail(buyer_phone);

  const client = await pool.connect();
  let orderId: string | null = null;
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
    if (!isEsimCapableSimKind(snap.sim_kind)) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "product_not_esim_capable",
        message: "eSIM 발급이 가능한 상품이 아닙니다.",
      };
    }

    const subtotal_krw = prepared.reduce((sum, p) => sum + p.line_total, 0);
    const discount_krw = subtotal_krw;
    const grand_total_krw = 0;
    const nowIso = new Date().toISOString();

    const consentsJson: Record<string, unknown> = {
      terms_version: "admin_complimentary_esim",
      terms_accepted: true,
      marketing: { accepted: false, version: null },
      complimentary_esim: {
        fulfillment: "complimentary_esim",
        created_by_admin_id: input.admin_id,
        created_at: nowIso,
        reason_category,
        reason_memo,
        granted_at: nowIso,
        granted_by_admin_id: input.admin_id,
      } satisfies ComplimentaryEsimConsentsV1,
    };

    const orderNumber = makeOrderNumber();
    const idempotency_key = `admin_complimentary_${randomUUID()}`;
    const paymentRef = `complimentary_${orderNumber}_${Date.now()}`;

    const ins = await client.query<{ order_id: string }>(
      `INSERT INTO bongsim_order (
        order_number, status, checkout_channel, buyer_email, buyer_tel, buyer_locale,
        idempotency_key, consents, currency, subtotal_krw, discount_krw, tax_krw, grand_total_krw,
        paid_at, payment_reference, paid_amount_krw, payment_provider
      ) VALUES ($1, 'paid', $2, $3, $4, 'ko', $5, $6::jsonb, 'KRW', $7, $8, 0, $9,
                now(), $10, 0, $11)
      RETURNING order_id::text AS order_id`,
      [
        orderNumber,
        COMPLIMENTARY_ESIM_CHECKOUT_CHANNEL,
        buyer_email,
        buyer_phone,
        idempotency_key,
        JSON.stringify(consentsJson),
        subtotal_krw,
        discount_krw,
        grand_total_krw,
        paymentRef,
        COMPLIMENTARY_ESIM_PAYMENT_PROVIDER,
      ],
    );
    orderId = ins.rows[0]?.order_id ?? null;
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

    const attemptKey = `complimentary_grant_${orderId}`;
    await client.query(
      `INSERT INTO bongsim_payment_attempt (
        order_id, idempotency_key, status, provider, provider_session_id, amount_krw, currency
      ) VALUES ($1::uuid, $2, 'captured', $3, $4, 0, 'KRW')
      ON CONFLICT (order_id, idempotency_key) DO NOTHING`,
      [orderId, attemptKey, COMPLIMENTARY_ESIM_PAYMENT_PROVIDER, paymentRef],
    );

    const dedupeKey = `bongsim:order_paid:${orderId}`;
    await client.query(
      `INSERT INTO bongsim_outbox (topic, payload, dedupe_key)
       VALUES ('OrderPaid', $1::jsonb, $2)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [JSON.stringify({ order_id: orderId, source: "admin_complimentary_esim" }), dedupeKey],
    );

    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[adminGrantComplimentaryEsim]", e);
    return { ok: false, reason: "db_error", message: "무상 eSIM 발급 중 오류가 발생했습니다." };
  } finally {
    client.release();
  }

  let fulfillment_started = false;
  if (orderId && !input.skip_outbox_drain) {
    try {
      await drainOrderPaidOutboxBestEffort(16);
      fulfillment_started = true;
      const { kickEsimQrNotifyDrain } = await import(
        "@/lib/bongsim/fulfillment/esim-qr-notify-outbox"
      );
      // 웹훅 도착 후 쌓인 알림톡을 순차 발송 (요청은 막지 않음)
      kickEsimQrNotifyDrain(40);
    } catch (e) {
      console.warn("[adminGrantComplimentaryEsim] outbox drain", e);
    }
  }

  const full = orderId ? await loadMinimalOrder(pool, orderId) : null;
  if (!full) return { ok: false, reason: "db_error", message: "주문 조회에 실패했습니다." };
  return { ok: true, order: full, fulfillment_started };
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
      payment_status: "captured",
      payment_provider: COMPLIMENTARY_ESIM_PAYMENT_PROVIDER,
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
