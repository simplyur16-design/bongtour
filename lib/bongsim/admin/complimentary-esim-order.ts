import { randomBytes, randomUUID } from "node:crypto";
import { isEsimCapableSimKind } from "@/lib/bongsim/catalog/active-product-sql";
import type { BongsimOrderV1 } from "@/lib/bongsim/contracts/order.v1";
import { prepareCatalogCheckoutLines } from "@/lib/bongsim/data/checkout-create-order";
import { kickOrderPaidOutboxDrain } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { classifyBongsimPgError, getPgPool, healBongsimPgPoolForCatalog } from "@/lib/bongsim/db/pool";
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
        | "db_error"
        | "connection_timeout";
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
        | "db_error"
        | "connection_timeout";
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
      // 루프 중 매번 drain 하면 타임아웃 — 전부 적재 후 아래에서 일괄 drain
      skip_outbox_drain: true,
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

  // REGRESSION-FREEZE[bongsim-complimentary-esim-bulk]: OrderPaid kick + QR kick(직렬) — 요청 중 SMS/USIMSA await 금지(빈 500) — manifest
  if (succeeded > 0) {
    try {
      // REGRESSION-FREEZE[bongsim-order-paid-kick-nonblocking]: 일괄 발급 HTTP에서 drain await 금지 — manifest
      kickOrderPaidOutboxDrain(Math.min(100, succeeded + 8));
      const { kickEsimQrNotifyDrain } = await import(
        "@/lib/bongsim/fulfillment/esim-qr-notify-outbox"
      );
      // SMS를 HTTP 응답 전에 await 하면 프록시 타임아웃 → 빈 500 (문자는 이미 감)
      kickEsimQrNotifyDrain(Math.min(80, succeeded * 2 + 8));
    } catch (e) {
      console.warn("[adminGrantComplimentaryEsimBulk] outbox/notify drain", e);
    }
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

  let client: import("pg").PoolClient;
  try {
    try {
      client = await pool.connect();
    } catch (first) {
      if (classifyBongsimPgError(first) !== "connection_timeout") {
        console.error("[adminGrantComplimentaryEsim] connect", first);
        return {
          ok: false,
          reason: "db_error",
          message: "무상 eSIM 발급 중 오류가 발생했습니다.",
        };
      }
      await healBongsimPgPoolForCatalog("complimentary-grant-connect");
      const pool2 = getPgPool();
      if (!pool2) {
        return {
          ok: false,
          reason: "connection_timeout",
          message: "DB 연결이 지연되었습니다. 잠시 후 다시 시도해 주세요.",
        };
      }
      try {
        client = await pool2.connect();
      } catch (second) {
        console.error("[adminGrantComplimentaryEsim] connect-retry", second);
        return {
          ok: false,
          reason:
            classifyBongsimPgError(second) === "connection_timeout"
              ? "connection_timeout"
              : "db_error",
          message:
            classifyBongsimPgError(second) === "connection_timeout"
              ? "DB 연결이 지연되었습니다. 잠시 후 다시 시도해 주세요."
              : "무상 eSIM 발급 중 오류가 발생했습니다.",
        };
      }
    }
  } catch (e) {
    console.error("[adminGrantComplimentaryEsim] connect-outer", e);
    return {
      ok: false,
      reason: classifyBongsimPgError(e) === "connection_timeout" ? "connection_timeout" : "db_error",
      message:
        classifyBongsimPgError(e) === "connection_timeout"
          ? "DB 연결이 지연되었습니다. 잠시 후 다시 시도해 주세요."
          : "무상 eSIM 발급 중 오류가 발생했습니다.",
    };
  }

  let orderId: string | null = null;
  let orderNumber = "";
  let preparedForResponse: Array<{
    option_api_id: string;
    quantity: number;
    unit_krw: number;
    line_total: number;
    basis_key: string;
    snapshot: BongsimOrderV1["order"]["lines"][0]["snapshot"];
  }> | null = null;
  let subtotalForResponse = 0;
  let discountForResponse = 0;
  let idempotencyForResponse = "";

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
    preparedForResponse = prepared;
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
    subtotalForResponse = subtotal_krw;
    discountForResponse = discount_krw;
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

    orderNumber = makeOrderNumber();
    const idempotency_key = `admin_complimentary_${randomUUID()}`;
    idempotencyForResponse = idempotency_key;
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
    if (classifyBongsimPgError(e) === "connection_timeout") {
      return {
        ok: false,
        reason: "connection_timeout",
        message: "DB 연결이 지연되었습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
    return { ok: false, reason: "db_error", message: "무상 eSIM 발급 중 오류가 발생했습니다." };
  } finally {
    client.release();
  }

  // COMMIT 성공 후 재조회하지 않음 — 풀 고갈·킥 레이스로 loadMinimalOrder throw → 빈 500 방지.
  // REGRESSION-FREEZE[bongsim-complimentary-grant-no-postcommit-500]: synthesize after commit — manifest
  if (!orderId || !preparedForResponse) {
    return { ok: false, reason: "db_error", message: "주문 저장에 실패했습니다." };
  }

  const full = synthesizeComplimentaryGrantOrder({
    order_id: orderId,
    order_number: orderNumber,
    buyer_email,
    idempotency_key: idempotencyForResponse,
    subtotal_krw: subtotalForResponse,
    discount_krw: discountForResponse,
    prepared: preparedForResponse,
  });

  let fulfillment_started = false;
  if (!input.skip_outbox_drain) {
    try {
      // REGRESSION-FREEZE[bongsim-order-paid-kick-nonblocking]: 무상발급 HTTP에서 USIMSA await 금지 — manifest
      kickOrderPaidOutboxDrain(16);
      fulfillment_started = true;
      const { kickEsimQrNotifyDrain } = await import(
        "@/lib/bongsim/fulfillment/esim-qr-notify-outbox"
      );
      kickEsimQrNotifyDrain(40);
    } catch (e) {
      console.warn("[adminGrantComplimentaryEsim] outbox drain", e);
    }
  }

  return { ok: true, order: full, fulfillment_started };
}

/** COMMIT 직후 재조회가 풀 고갈로 실패해도 관리자 UI에 성공을 돌려준다. */
function synthesizeComplimentaryGrantOrder(input: {
  order_id: string;
  order_number: string;
  buyer_email: string;
  idempotency_key: string;
  subtotal_krw: number;
  discount_krw: number;
  prepared: Array<{
    option_api_id: string;
    quantity: number;
    unit_krw: number;
    line_total: number;
    basis_key: string;
    snapshot: BongsimOrderV1["order"]["lines"][0]["snapshot"];
  }>;
}): BongsimOrderV1["order"] {
  const now = new Date().toISOString();
  return {
    order_id: input.order_id,
    order_number: input.order_number,
    status: "paid",
    created_at: now,
    updated_at: now,
    checkout_channel: COMPLIMENTARY_ESIM_CHECKOUT_CHANNEL,
    buyer: { email: input.buyer_email, locale: "ko" },
    consents: {
      terms_version: "admin_complimentary_esim",
      terms_accepted: true,
      marketing: { accepted: false, version: null },
    },
    idempotency_key: input.idempotency_key,
    totals: {
      currency: "KRW",
      subtotal_krw: input.subtotal_krw,
      discount_krw: input.discount_krw,
      tax_krw: 0,
      grand_total_krw: 0,
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
    lines: input.prepared.map((p, idx) => ({
      line_id: `synthetic-${idx}`,
      option_api_id: p.option_api_id,
      quantity: p.quantity,
      charged_unit_price_krw: p.unit_krw,
      line_total_krw: p.line_total,
      charged_basis_key: p.basis_key,
      snapshot: p.snapshot,
    })),
  };
}
