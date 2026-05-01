import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import type { BongsimCheckoutConfirmRequestV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import type { BongsimOrderLineSnapshotV1, BongsimOrderV1 } from "@/lib/bongsim/contracts/order.v1";
import type { BongsimProductOptionV1 } from "@/lib/bongsim/contracts/product-master.v1";
import { getPgPool } from "@/lib/bongsim/db/pool";
import type { BongsimProductOptionDbRow } from "@/lib/bongsim/data/bongsim-product-option-db-row";
import { mapDbRowToProductOptionV1 } from "@/lib/bongsim/data/map-row-to-product-option-v1";
import { parseFlagsJson, parsePriceBlockJson } from "@/lib/bongsim/data/parse-product-json";
import { selectChargedUnitPriceKrw } from "@/lib/bongsim/data/pricing-select-charged";
import type { NetworkFamily, PlanLineExcel, PlanType } from "@/lib/bongsim/contracts/public-enums";

export type CheckoutCreateOrderResult =
  | { ok: true; order: BongsimOrderV1["order"]; reused: boolean }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "db_error"
        | "validation"
        | "product_not_found"
        | "idempotency_mismatch";
      details?: Record<string, string>;
    };

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
  checkout_channel: string;
  buyer_email: string;
  buyer_locale: string | null;
  idempotency_key: string;
  consents: unknown;
  currency: string;
  subtotal_krw: string;
  discount_krw: string;
  tax_krw: string;
  grand_total_krw: string;
  created_at: Date;
  updated_at: Date;
};

type OrderLineRow = {
  line_id: string;
  order_id: string;
  option_api_id: string;
  quantity: number;
  charged_unit_price_krw: string;
  line_total_krw: string;
  charged_basis_key: string;
  snapshot: unknown;
  created_at: Date;
};

function normEmail(s: string): string {
  return s.trim().toLowerCase();
}

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** 010-1234-5678 형태(11자리 010) 등 국내 휴대 표시용. */
function formatKrBuyertelDisplay(raw: string): string {
  const d = digitsOnly(raw).slice(0, 11);
  if (d.length === 0) return "";
  if (d.startsWith("010")) {
    if (d.length <= 3) return d;
    if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function makeOrderNumber(): string {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rnd = randomBytes(4).toString("hex").toUpperCase();
  return `BS-${day}-${rnd}`;
}

function toInt(n: string | number): number {
  return typeof n === "string" ? Number.parseInt(n, 10) : Math.trunc(Number(n));
}

function strField(v: string | null | undefined): string {
  return v ?? "";
}

function buildLineSnapshot(
  opt: BongsimProductOptionV1,
  charged_basis_key: string,
  charged_unit_price_krw: number,
): BongsimOrderLineSnapshotV1 {
  return {
    option_api_id: opt.option_api_id,
    charged_basis_key,
    charged_unit_price_krw,
    vendor_code: opt.vendor_code,
    sim_kind: opt.sim_kind,
    plan_name: opt.plan_name,
    option_label: opt.option_label,
    days_raw: opt.days_raw,
    allowance_label: opt.allowance_label,
    network_family: opt.network_family,
    plan_type: opt.plan_type,
    plan_line_excel: opt.plan_line_excel,
    price_block: opt.price_block,
    carrier_raw: strField(opt.carrier_raw),
    network_raw: strField(opt.network_raw),
    internet_raw: strField(opt.internet_raw),
    data_class_raw: strField(opt.data_class_raw),
    qos_raw: strField(opt.qos_raw),
    validity_raw: strField(opt.validity_raw),
    apn_raw: strField(opt.apn_raw),
    install_benchmark_raw: strField(opt.install_benchmark_raw),
    activation_policy_raw: strField(opt.activation_policy_raw),
    mcc_raw: strField(opt.mcc_raw),
    mnc_raw: strField(opt.mnc_raw),
    flags: opt.flags,
    classification_conflict: opt.classification_conflict,
    classification_notes: opt.classification_notes,
  };
}

function defaultPayment(): BongsimOrderV1["order"]["payment"] {
  return {
    payment_status: "unpaid",
    payment_provider: null,
    payment_reference: null,
    paid_amount_krw: 0,
    paid_currency: "KRW",
    paid_at: null,
    failure: { code: null, message: null },
  };
}

function defaultFulfillment(): BongsimOrderV1["order"]["fulfillment"] {
  return {
    fulfillment_status: "not_started",
    supplier_submission_id: null,
    supplier_ids: { profile: null, iccid: null, other: {} },
    attempt_count: 0,
    last_error: { code: null, at: null },
    delivered_at: null,
    audit: { payload_out_ref: null, payload_in_last_ref: null },
  };
}

function parseConsents(raw: unknown): BongsimOrderV1["order"]["consents"] {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const marketing = o.marketing && typeof o.marketing === "object" ? (o.marketing as Record<string, unknown>) : {};
  const kakaoRaw = o.kakaoId ?? o.kakao_id;
  const kakaoStr = typeof kakaoRaw === "string" ? kakaoRaw.trim() : "";
  const telRaw = o.buyertel ?? o.buyer_tel;
  const telStr = typeof telRaw === "string" ? telRaw.trim() : "";
  return {
    terms_version: typeof o.terms_version === "string" ? o.terms_version : "",
    terms_accepted: true,
    marketing: {
      accepted: Boolean(marketing.accepted),
      version: typeof marketing.version === "string" ? marketing.version : null,
    },
    ...(telStr ? { buyertel: telStr } : {}),
    ...(kakaoStr ? { kakao_id: kakaoStr } : {}),
  };
}

function parseSnapshot(raw: unknown): BongsimOrderLineSnapshotV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.option_api_id !== "string") return null;
  if (typeof s.charged_basis_key !== "string") return null;
  if (typeof s.charged_unit_price_krw !== "number" || !Number.isFinite(s.charged_unit_price_krw)) return null;
  if (typeof s.vendor_code !== "string" || typeof s.sim_kind !== "string") return null;
  const network_family = s.network_family;
  const plan_line_excel = s.plan_line_excel;
  if (network_family !== "local" && network_family !== "roaming") return null;
  if (typeof plan_line_excel !== "string") return null;
  const plan_type_raw = s.plan_type;
  const plan_type: PlanType =
    plan_type_raw === "unlimited" || plan_type_raw === "fixed" || plan_type_raw === "daily"
      ? plan_type_raw
      : null;
  return {
    option_api_id: s.option_api_id,
    charged_basis_key: s.charged_basis_key,
    charged_unit_price_krw: Math.trunc(s.charged_unit_price_krw),
    vendor_code: s.vendor_code,
    sim_kind: s.sim_kind,
    plan_name: String(s.plan_name ?? ""),
    option_label: String(s.option_label ?? ""),
    days_raw: String(s.days_raw ?? ""),
    allowance_label: String(s.allowance_label ?? ""),
    network_family: network_family as NetworkFamily,
    plan_type,
    plan_line_excel: plan_line_excel as PlanLineExcel,
    price_block: parsePriceBlockJson(s.price_block),
    carrier_raw: String(s.carrier_raw ?? ""),
    network_raw: String(s.network_raw ?? ""),
    internet_raw: String(s.internet_raw ?? ""),
    data_class_raw: String(s.data_class_raw ?? ""),
    qos_raw: String(s.qos_raw ?? ""),
    validity_raw: String(s.validity_raw ?? ""),
    apn_raw: String(s.apn_raw ?? ""),
    install_benchmark_raw: String(s.install_benchmark_raw ?? ""),
    activation_policy_raw: String(s.activation_policy_raw ?? ""),
    mcc_raw: String(s.mcc_raw ?? ""),
    mnc_raw: String(s.mnc_raw ?? ""),
    flags: parseFlagsJson(s.flags),
    classification_conflict: Boolean(s.classification_conflict),
    classification_notes: typeof s.classification_notes === "string" ? s.classification_notes : null,
  };
}

async function loadOrderWithLines(client: PoolClient, orderId: string): Promise<BongsimOrderV1["order"] | null> {
  const o = await client.query<OrderRow>(`SELECT * FROM bongsim_order WHERE order_id = $1`, [orderId]);
  const order = o.rows[0];
  if (!order) return null;
  const ls = await client.query<OrderLineRow>(
    `SELECT * FROM bongsim_order_line WHERE order_id = $1 ORDER BY created_at ASC`,
    [orderId],
  );
  const lines: BongsimOrderV1["order"]["lines"] = [];
  for (const row of ls.rows) {
    const snap = parseSnapshot(row.snapshot);
    if (!snap) return null;
    lines.push({
      line_id: row.line_id,
      option_api_id: row.option_api_id,
      quantity: row.quantity,
      charged_unit_price_krw: toInt(row.charged_unit_price_krw),
      line_total_krw: toInt(row.line_total_krw),
      charged_basis_key: row.charged_basis_key,
      snapshot: snap,
    });
  }
  return mapOrderRow(order, lines);
}

function mapOrderRow(order: OrderRow, lines: BongsimOrderV1["order"]["lines"]): BongsimOrderV1["order"] {
  return {
    order_id: order.order_id,
    order_number: order.order_number,
    status: order.status as BongsimOrderV1["order"]["status"],
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
    checkout_channel: order.checkout_channel,
    buyer: {
      email: order.buyer_email,
      locale: order.buyer_locale === "ko" || order.buyer_locale === "en" ? order.buyer_locale : null,
    },
    consents: parseConsents(order.consents),
    idempotency_key: order.idempotency_key,
    totals: {
      currency: "KRW",
      subtotal_krw: toInt(order.subtotal_krw),
      discount_krw: toInt(order.discount_krw),
      tax_krw: toInt(order.tax_krw),
      grand_total_krw: toInt(order.grand_total_krw),
    },
    payment: defaultPayment(),
    fulfillment: defaultFulfillment(),
    lines,
  };
}

function validateRequest(body: unknown): { ok: true; req: BongsimCheckoutConfirmRequestV1 } | { ok: false; details: Record<string, string> } {
  if (!body || typeof body !== "object") return { ok: false, details: { body: "invalid_json" } };
  const o = body as Record<string, unknown>;
  const option_api_id = typeof o.option_api_id === "string" ? o.option_api_id.trim() : "";
  const buyer_email = typeof o.buyer_email === "string" ? o.buyer_email.trim() : "";
  const idempotency_key = typeof o.idempotency_key === "string" ? o.idempotency_key.trim() : "";
  const qRaw = o.quantity;
  const quantity =
    typeof qRaw === "number"
      ? qRaw
      : typeof qRaw === "string"
        ? Number.parseInt(qRaw, 10)
        : Number.NaN;
  const details: Record<string, string> = {};
  if (!option_api_id) details.option_api_id = "required";
  if (!buyer_email) {
    details.buyer_email = "required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer_email)) {
    details.buyer_email = "invalid_email";
  }
  if (!idempotency_key) details.idempotency_key = "required";
  if (!Number.isInteger(quantity) || quantity < 1) {
    details.quantity = "must_be_integer_gte_1";
  } else if (quantity > 99) {
    details.quantity = "max_99";
  }
  const buyertelRaw = typeof o.buyertel === "string" ? o.buyertel : "";
  const telDigits = digitsOnly(buyertelRaw);
  if (!telDigits) {
    details.buyertel = "required";
  } else if (telDigits.length < 10 || telDigits.length > 11) {
    details.buyertel = "invalid_phone";
  }
  const kakaoIdRaw = o.kakaoId;
  const kakaoTrim =
    typeof kakaoIdRaw === "string" ? kakaoIdRaw.trim().slice(0, 64) : typeof o.kakao_id === "string" ? o.kakao_id.trim().slice(0, 64) : "";
  if (Object.keys(details).length) return { ok: false, details };
  const locale = o.buyer_locale;
  const buyer_locale = locale === "ko" || locale === "en" ? locale : undefined;
  const req: BongsimCheckoutConfirmRequestV1 = {
    schema: "bongsim.checkout_confirm.request.v1",
    option_api_id,
    quantity,
    buyer_email: normEmail(buyer_email),
    buyertel: formatKrBuyertelDisplay(buyertelRaw),
    kakaoId: kakaoTrim || undefined,
    buyer_locale,
    idempotency_key,
    checkout_channel: typeof o.checkout_channel === "string" ? o.checkout_channel : undefined,
    consents:
      o.consents && typeof o.consents === "object"
        ? (o.consents as BongsimCheckoutConfirmRequestV1["consents"])
        : undefined,
  };
  return { ok: true, req };
}

function assertIdempotentMatch(order: BongsimOrderV1["order"], req: BongsimCheckoutConfirmRequestV1): boolean {
  const line = order.lines[0];
  if (!line) return false;
  if (line.option_api_id !== req.option_api_id) return false;
  if (line.quantity !== req.quantity) return false;
  if (normEmail(order.buyer.email) !== req.buyer_email) return false;
  const storedTel = order.consents.buyertel ?? "";
  if (digitsOnly(storedTel) !== digitsOnly(req.buyertel)) return false;
  const storedKakao = (order.consents.kakao_id ?? "").trim();
  const reqKakao = (req.kakaoId ?? "").trim();
  if (storedKakao !== reqKakao) return false;
  return true;
}

export async function checkoutCreateOrderFromRequest(body: unknown): Promise<CheckoutCreateOrderResult> {
  const v = validateRequest(body);
  if (!v.ok) return { ok: false, reason: "validation", details: v.details };

  const req = v.req;
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ order_id: string }>(
      `SELECT order_id FROM bongsim_order WHERE idempotency_key = $1 FOR UPDATE`,
      [req.idempotency_key],
    );
    if (existing.rows[0]) {
      const full = await loadOrderWithLines(client, existing.rows[0].order_id);
      await client.query("COMMIT");
      if (!full) return { ok: false, reason: "db_error" };
      if (!assertIdempotentMatch(full, req)) return { ok: false, reason: "idempotency_mismatch" };
      return { ok: true, order: full, reused: true };
    }

    const pr = await client.query<BongsimProductOptionDbRow>(
      `SELECT * FROM bongsim_product_option WHERE option_api_id = $1 FOR SHARE`,
      [req.option_api_id],
    );
    if (!pr.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "product_not_found" };
    }
    const opt = mapDbRowToProductOptionV1(pr.rows[0]);

    const { basis_key, unit_krw } = selectChargedUnitPriceKrw(opt.price_block);
    const line_total = unit_krw * req.quantity;
    const snapshot = buildLineSnapshot(opt, basis_key, unit_krw);

    const consentsJson: Record<string, unknown> = {
      terms_version: req.consents?.terms_version ?? "",
      terms_accepted: req.consents?.terms_accepted !== false,
      marketing: {
        accepted: Boolean(req.consents?.marketing?.accepted),
        version: req.consents?.marketing?.version ?? null,
      },
      buyertel: req.buyertel,
    };
    if (req.kakaoId?.trim()) consentsJson.kakaoId = req.kakaoId.trim();

    const orderNumber = makeOrderNumber();
    // NOTE: `bongsim_order` 에 `buyer_tel` / `kakao_id` 전용 컬럼이 없으면 ALTER 로 추가 후 INSERT 에서 분리 저장하는 편이 좋음. 현재는 `consents` JSONB 에만 보관.
    const ins = await client.query<OrderRow>(
      `INSERT INTO bongsim_order (
        order_number, status, checkout_channel, buyer_email, buyer_locale,
        idempotency_key, consents, currency, subtotal_krw, discount_krw, tax_krw, grand_total_krw
      ) VALUES ($1, 'awaiting_payment', $2, $3, $4, $5, $6::jsonb, 'KRW', $7, 0, 0, $7)
      RETURNING *`,
      [
        orderNumber,
        req.checkout_channel ?? "web",
        req.buyer_email,
        req.buyer_locale ?? null,
        req.idempotency_key,
        JSON.stringify(consentsJson),
        line_total,
      ],
    );
    const orderRow = ins.rows[0];
    if (!orderRow) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "db_error" };
    }

    await client.query(
      `INSERT INTO bongsim_order_line (
        order_id, option_api_id, quantity, charged_unit_price_krw, line_total_krw, charged_basis_key, snapshot
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        orderRow.order_id,
        req.option_api_id,
        req.quantity,
        unit_krw,
        line_total,
        basis_key,
        JSON.stringify(snapshot),
      ],
    );

    await client.query("COMMIT");

    const full = await loadOrderWithLines(client, orderRow.order_id);
    if (!full) return { ok: false, reason: "db_error" };
    return { ok: true, order: full, reused: false };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    const err = e as { code?: string };
    if (err.code === "23505") {
      const c2 = await pool.connect();
      try {
        const r = await c2.query<{ order_id: string }>(
          `SELECT order_id FROM bongsim_order WHERE idempotency_key = $1`,
          [req.idempotency_key],
        );
        const oid = r.rows[0]?.order_id;
        if (!oid) return { ok: false, reason: "db_error" };
        const full = await loadOrderWithLines(c2, oid);
        if (!full) return { ok: false, reason: "db_error" };
        if (!assertIdempotentMatch(full, req)) return { ok: false, reason: "idempotency_mismatch" };
        return { ok: true, order: full, reused: true };
      } finally {
        c2.release();
      }
    }
    return { ok: false, reason: "db_error" };
  } finally {
    client.release();
  }
}
