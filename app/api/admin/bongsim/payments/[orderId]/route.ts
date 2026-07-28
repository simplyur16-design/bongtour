import { NextResponse } from "next/server";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  bongsimAdminQueryFailurePayload,
  withBongsimAdminPgRetry,
} from "@/lib/bongsim/db/admin-query";
import { requireAdmin } from "@/lib/require-admin";
import { supportsUsimFulfillment } from "@/lib/bongsim/catalog/sim-fulfillment";
import { parseOfflineUsimConsents } from "@/lib/bongsim/admin/offline-usim-order";
import { parseComplimentaryEsimConsents } from "@/lib/bongsim/admin/complimentary-esim-order";

export const dynamic = "force-dynamic";

// REGRESSION-FREEZE[bongsim-admin-payments-query]: detail probe·retry — manifest

function lineUsimCapable(snapshot: unknown): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const simKind = (snapshot as Record<string, unknown>).sim_kind;
  return supportsUsimFulfillment(typeof simKind === "string" ? simKind : "");
}

function topupKind(payload: unknown): "esim" | "usim" {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "esim";
  return (payload as Record<string, unknown>).fulfillment_kind === "usim" ? "usim" : "esim";
}

export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { orderId } = await ctx.params;
  const id = (orderId ?? "").trim();
  if (!id) return NextResponse.json({ error: "missing_order_id" }, { status: 400 });

  if (!getPgPool()) return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });

  try {
    const payload = await withBongsimAdminPgRetry(async (pool) => {
      const o = await pool.query(
        `SELECT order_id::text AS order_id, order_number, status, buyer_email, buyer_tel,
                grand_total_krw::text AS grand_total_krw,
                subtotal_krw::text AS subtotal_krw, discount_krw::text AS discount_krw, currency,
                payment_reference, payment_provider, paid_at, created_at, updated_at, consents,
                checkout_channel
           FROM bongsim_order WHERE order_id = $1::uuid LIMIT 1`,
        [id],
      );
      if (o.rows.length === 0) {
        return { not_found: true as const };
      }

      const lines = await pool.query(
        `SELECT line_id::text AS line_id, option_api_id, quantity,
                charged_unit_price_krw::text AS charged_unit_price_krw,
                line_total_krw::text AS line_total_krw, charged_basis_key, snapshot, created_at
           FROM bongsim_order_line WHERE order_id = $1::uuid ORDER BY created_at ASC`,
        [id],
      );

      const attempts = await pool.query(
        `SELECT payment_attempt_id::text AS payment_attempt_id, status, provider, provider_session_id,
                amount_krw::text AS amount_krw, currency, created_at, updated_at
           FROM bongsim_payment_attempt WHERE order_id = $1::uuid ORDER BY created_at ASC`,
        [id],
      );

      const jobs = await pool.query(
        `SELECT job_id::text AS job_id, status, supplier_id, supplier_order_ref,
                supplier_submission_id, delivered_at, submitted_at, created_at, updated_at
           FROM bongsim_fulfillment_job WHERE order_id = $1::uuid ORDER BY created_at ASC`,
        [id],
      );

      const topups = await pool.query(
        `SELECT topup_row_id::text AS topup_row_id, job_id::text AS job_id, option_api_id,
                topup_id, status, iccid, webhook_payload, created_at, updated_at
           FROM bongsim_fulfillment_topup WHERE order_id = $1::uuid ORDER BY created_at ASC`,
        [id],
      );

      const enrichedLines = lines.rows.map((row) => ({
        ...row,
        usim_capable: lineUsimCapable(row.snapshot),
        plan_name:
          row.snapshot && typeof row.snapshot === "object"
            ? String((row.snapshot as Record<string, unknown>).plan_name ?? "")
            : "",
      }));

      const enrichedTopups = topups.rows.map((row) => ({
        ...row,
        fulfillment_kind: topupKind(row.webhook_payload),
      }));

      return {
        not_found: false as const,
        body: {
          order: o.rows[0],
          lines: enrichedLines,
          payment_attempts: attempts.rows,
          fulfillment_jobs: jobs.rows,
          fulfillment_topups: enrichedTopups,
          offline_usim: parseOfflineUsimConsents(o.rows[0]?.consents),
          complimentary_esim: parseComplimentaryEsimConsents(o.rows[0]?.consents),
        },
      };
    });

    if (payload.not_found) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(payload.body);
  } catch (e) {
    console.error("[admin/bongsim/payments/[orderId] GET]", e);
    const { status, body } = bongsimAdminQueryFailurePayload(e);
    return NextResponse.json(body, { status });
  }
}
