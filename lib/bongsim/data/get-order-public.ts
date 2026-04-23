import { timingSafeEqual } from "node:crypto";
import { getPgPool } from "@/lib/bongsim/db/pool";
import type { BongsimOrderPublicV1 } from "@/lib/bongsim/contracts/order-public.v1";

export type GetOrderPublicResult =
  | { ok: true; order: BongsimOrderPublicV1 }
  | {
      ok: false;
      reason: "db_unconfigured" | "not_found" | "db_error" | "read_key_required" | "read_key_invalid";
    };

function compareReadKey(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function toInt(n: string | number): number {
  return typeof n === "string" ? Number.parseInt(n, 10) : Math.trunc(Number(n));
}

function maskEmail(email: string): string {
  const e = email.trim();
  const at = e.indexOf("@");
  if (at <= 1) return "***";
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  const vis = local.slice(0, Math.min(2, local.length));
  return `${vis}***@${domain}`;
}

function parseLineSnapshot(snap: unknown): { plan_name: string; option_label: string } {
  if (!snap || typeof snap !== "object") return { plan_name: "—", option_label: "—" };
  const o = snap as Record<string, unknown>;
  return {
    plan_name: typeof o.plan_name === "string" && o.plan_name.trim() ? o.plan_name : "—",
    option_label: typeof o.option_label === "string" && o.option_label.trim() ? o.option_label : "—",
  };
}

export async function getOrderPublic(orderId: string, opts?: { readKey?: string | null }): Promise<GetOrderPublicResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured" };

  const id = orderId.trim();
  if (!id) return { ok: false, reason: "not_found" };

  const gate = process.env.BONGSIM_ORDER_READ_KEY?.trim();
  if (gate) {
    const provided = (opts?.readKey ?? "").trim();
    if (!provided) return { ok: false, reason: "read_key_required" };
    if (!compareReadKey(provided, gate)) return { ok: false, reason: "read_key_invalid" };
  }

  try {
    const o = await pool.query(
      `SELECT order_id, order_number, status, currency, grand_total_krw, buyer_email,
              paid_at, payment_reference, paid_amount_krw, payment_provider
       FROM bongsim_order WHERE order_id = $1 LIMIT 1`,
      [id],
    );
    const row = o.rows[0] as
      | {
          order_id: string;
          order_number: string;
          status: string;
          currency: string;
          grand_total_krw: string;
          buyer_email: string;
          paid_at: Date | null;
          payment_reference: string | null;
          paid_amount_krw: string | null;
          payment_provider: string | null;
        }
      | undefined;
    if (!row) return { ok: false, reason: "not_found" };

    const ls = await pool.query(
      `SELECT option_api_id, quantity, snapshot, line_total_krw FROM bongsim_order_line WHERE order_id = $1 ORDER BY created_at ASC`,
      [id],
    );

    const lines = ls.rows.map((r: { option_api_id: string; quantity: number; snapshot: unknown; line_total_krw: string }) => {
      const sn = parseLineSnapshot(r.snapshot);
      return {
        option_api_id: r.option_api_id,
        quantity: r.quantity,
        plan_name: sn.plan_name,
        option_label: sn.option_label,
        line_total_krw: toInt(r.line_total_krw),
      };
    });

    const fj = await pool.query(
      `SELECT job_id, status, supplier_submission_id, supplier_profile_ref, supplier_iccid, delivered_at, attempt_count
       FROM bongsim_fulfillment_job
       WHERE order_id = $1
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`,
      [id],
    );
    const fr = fj.rows[0] as
      | {
          job_id: string;
          status: string;
          supplier_submission_id: string | null;
          supplier_profile_ref: string | null;
          supplier_iccid: string | null;
          delivered_at: Date | null;
          attempt_count: number;
        }
      | undefined;

    const fulfillment = fr
      ? {
          job_id: fr.job_id,
          status: fr.status,
          supplier_submission_id: fr.supplier_submission_id,
          supplier_profile_ref: fr.supplier_profile_ref ?? null,
          supplier_iccid: fr.supplier_iccid ?? null,
          delivered_at: fr.delivered_at ? fr.delivered_at.toISOString() : null,
          attempt_count: fr.attempt_count,
        }
      : null;

    const order: BongsimOrderPublicV1 = {
      schema: "bongsim.order_public.v1",
      order_id: row.order_id,
      order_number: row.order_number,
      status: row.status,
      currency: row.currency === "KRW" ? "KRW" : "KRW",
      grand_total_krw: toInt(row.grand_total_krw),
      buyer_email_masked: maskEmail(row.buyer_email),
      paid_at: row.paid_at ? row.paid_at.toISOString() : null,
      payment_reference: row.payment_reference,
      paid_amount_krw: row.paid_amount_krw != null ? toInt(row.paid_amount_krw) : null,
      payment_provider: row.payment_provider,
      lines,
      fulfillment,
      install_stub: {
        kind: "placeholder",
        label: "eSIM 설치 링크는 준비 중입니다.",
        href: null,
      },
    };

    return { ok: true, order };
  } catch {
    return { ok: false, reason: "db_error" };
  }
}
