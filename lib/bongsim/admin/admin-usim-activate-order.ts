import type { PoolClient } from "pg";
import { getPgPool } from "@/lib/bongsim/db/pool";
import {
  normalizeIccid,
  supportsUsimFulfillment,
} from "@/lib/bongsim/catalog/sim-fulfillment";
import { promoteFulfillmentJobIfReady } from "@/lib/bongsim/supplier/usimsa/webhook-parser";
import {
  cancelUsimsaTopup,
  submitUsimsaUsimOrder,
} from "@/lib/bongsim/supplier/usimsa/order-api";
import { isUsimsaSuccess } from "@/lib/bongsim/supplier/usimsa/types";

const USIMSA_SUPPLIER_ID = "usimsa";

export type AdminUsimActivateResult =
  | { ok: true; topup_id: string; iccid: string; canceled_esim_topup_id?: string }
  | {
      ok: false;
      reason:
        | "db_unconfigured"
        | "order_not_found"
        | "invalid_status"
        | "line_not_found"
        | "product_not_usim_capable"
        | "invalid_iccid"
        | "quantity_exhausted"
        | "esim_already_issued"
        | "duplicate_iccid"
        | "supplier_submit_failed"
        | "esim_cancel_failed"
        | "db_error";
      message: string;
    };

type OrderRow = { order_id: string; order_number: string; status: string };
type LineRow = { line_id: string; option_api_id: string; quantity: number; snapshot: unknown };
type TopupRow = {
  topup_id: string;
  status: string;
  iccid: string | null;
  option_api_id: string;
  webhook_payload: unknown;
};

function topupFulfillmentKind(payload: unknown): "esim" | "usim" {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "esim";
  const k = (payload as Record<string, unknown>).fulfillment_kind;
  return k === "usim" ? "usim" : "esim";
}

function isTerminalTopupStatus(status: string): boolean {
  return status === "canceled" || status === "failed";
}

function isEsimIssuedStatus(status: string): boolean {
  return status === "iccid_ready" || status === "delivered";
}

async function appendFulfillmentEvent(
  client: PoolClient,
  orderId: string,
  jobId: string,
  kind: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `INSERT INTO bongsim_fulfillment_event (order_id, job_id, kind, payload_json)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [orderId, jobId, kind, JSON.stringify(payload)],
  );
}

async function getOrCreateFulfillmentJob(client: PoolClient, orderId: string): Promise<string> {
  const existing = await client.query<{ job_id: string }>(
    `SELECT job_id FROM bongsim_fulfillment_job
      WHERE order_id = $1
        AND status NOT IN ('failed')
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE`,
    [orderId],
  );
  if (existing.rows[0]?.job_id) return existing.rows[0].job_id;

  const ins = await client.query<{ job_id: string }>(
    `INSERT INTO bongsim_fulfillment_job (order_id, status, attempt_count)
     VALUES ($1, 'submitted', 0)
     RETURNING job_id`,
    [orderId],
  );
  const jobId = ins.rows[0]?.job_id;
  if (!jobId) throw new Error("fulfillment_job_insert_failed");
  return jobId;
}

/** REGRESSION-FREEZE[bongsim-usim-fulfillment]: 어드민 물리 USIM ICCID 수동 활성화 — manifest */
export async function adminActivateUsimForPaidOrder(input: {
  order_id: string;
  option_api_id: string;
  iccid_raw: string;
  admin_id: string;
}): Promise<AdminUsimActivateResult> {
  const pool = getPgPool();
  if (!pool) return { ok: false, reason: "db_unconfigured", message: "DB 미연결" };

  const iccid = normalizeIccid(input.iccid_raw);
  if (!iccid) {
    return { ok: false, reason: "invalid_iccid", message: "ICCID는 19~20자리 숫자여야 합니다." };
  }

  const client = await pool.connect();
  let order: OrderRow | undefined;
  let line: LineRow | undefined;
  let topups: TopupRow[] = [];
  let esimTopupToCancel: string | null = null;

  try {
    await client.query("BEGIN");

    const o = await client.query<OrderRow>(
      `SELECT order_id::text AS order_id, order_number, status
         FROM bongsim_order WHERE order_id = $1::uuid FOR UPDATE`,
      [input.order_id],
    );
    order = o.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "order_not_found", message: "주문을 찾을 수 없습니다." };
    }
    if (order.status !== "paid" && order.status !== "delivered") {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "invalid_status",
        message: "결제완료·전달완료 주문만 물리 USIM 활성화할 수 있습니다.",
      };
    }

    const ls = await client.query<LineRow>(
      `SELECT line_id::text AS line_id, option_api_id, quantity, snapshot
         FROM bongsim_order_line
        WHERE order_id = $1::uuid AND option_api_id = $2
        FOR UPDATE`,
      [input.order_id, input.option_api_id],
    );
    line = ls.rows[0];
    if (!line) {
      await client.query("ROLLBACK");
      return { ok: false, reason: "line_not_found", message: "해당 상품 라인을 찾을 수 없습니다." };
    }

    const snap =
      typeof line.snapshot === "object" && line.snapshot
        ? (line.snapshot as Record<string, unknown>)
        : {};
    const simKind = typeof snap.sim_kind === "string" ? snap.sim_kind : "";
    if (!supportsUsimFulfillment(simKind)) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "product_not_usim_capable",
        message: "이 상품은 물리 USIM 활성화를 지원하지 않습니다.",
      };
    }

    const dup = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM bongsim_fulfillment_topup
        WHERE supplier_id = $1 AND iccid = $2 AND status NOT IN ('canceled', 'failed')`,
      [USIMSA_SUPPLIER_ID, iccid],
    );
    if (Number.parseInt(dup.rows[0]?.n ?? "0", 10) > 0) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "duplicate_iccid",
        message: "이미 사용 중인 ICCID입니다.",
      };
    }

    const tr = await client.query<TopupRow>(
      `SELECT topup_id, status, iccid, option_api_id, webhook_payload
         FROM bongsim_fulfillment_topup
        WHERE order_id = $1::uuid AND supplier_id = $2
        FOR UPDATE`,
      [input.order_id, USIMSA_SUPPLIER_ID],
    );
    topups = tr.rows;

    const lineTopups = topups.filter((t) => t.option_api_id === line!.option_api_id);
    const activeLineTopups = lineTopups.filter((t) => !isTerminalTopupStatus(t.status));
    if (activeLineTopups.length >= line.quantity) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "quantity_exhausted",
        message: "이 라인의 활성화 가능 수량을 모두 사용했습니다.",
      };
    }

    const esimIssued = lineTopups.some(
      (t) => topupFulfillmentKind(t.webhook_payload) === "esim" && isEsimIssuedStatus(t.status),
    );
    if (esimIssued) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        reason: "esim_already_issued",
        message:
          "eSIM이 이미 발급된 주문입니다. 물리 USIM 활성화 전 환불·취소가 필요할 수 있습니다.",
      };
    }

    const cancelCandidate = lineTopups.find(
      (t) =>
        topupFulfillmentKind(t.webhook_payload) === "esim" &&
        t.status === "issued_topup" &&
        !t.iccid,
    );
    esimTopupToCancel = cancelCandidate?.topup_id ?? null;

    await client.query("COMMIT");
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[admin-usim-activate] preflight", e);
    return { ok: false, reason: "db_error", message: "주문 검증 중 오류가 발생했습니다." };
  } finally {
    client.release();
  }

  if (esimTopupToCancel) {
    try {
      await cancelUsimsaTopup(esimTopupToCancel);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[admin-usim-activate] esim cancel failed", { topupId: esimTopupToCancel, msg });
      return {
        ok: false,
        reason: "esim_cancel_failed",
        message: "기존 eSIM 예약 취소에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      };
    }
  }

  const usimSeq =
    topups.filter(
      (t) =>
        t.option_api_id === line!.option_api_id &&
        topupFulfillmentKind(t.webhook_payload) === "usim" &&
        !isTerminalTopupStatus(t.status),
    ).length + 1;
  const partnerOrderId =
    line!.quantity === 1 && usimSeq === 1
      ? order!.order_number
      : `${order!.order_number}-u${usimSeq}`;

  let topupId: string;
  try {
    const res = await submitUsimsaUsimOrder({
      orderId: partnerOrderId,
      optionId: line!.option_api_id,
      iccid,
    });
    if ("skipped" in res) {
      topupId = res.topupId;
    } else {
      if (!isUsimsaSuccess(res.code) || !res.topupId) {
        return {
          ok: false,
          reason: "supplier_submit_failed",
          message: `유심사 USIM 활성화 거절: ${res.message || res.code}`,
        };
      }
      topupId = res.topupId;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin-usim-activate] submit failed", msg);
    return {
      ok: false,
      reason: "supplier_submit_failed",
      message: "유심사 USIM 활성화 API 호출에 실패했습니다.",
    };
  }

  const client2 = await pool.connect();
  try {
    await client2.query("BEGIN");

    if (esimTopupToCancel) {
      await client2.query(
        `UPDATE bongsim_fulfillment_topup
            SET status = 'canceled', canceled_at = COALESCE(canceled_at, now()), updated_at = now()
          WHERE supplier_id = $1 AND topup_id = $2`,
        [USIMSA_SUPPLIER_ID, esimTopupToCancel],
      );
    }

    const jobId = await getOrCreateFulfillmentJob(client2, input.order_id);

    await client2.query(
      `INSERT INTO bongsim_fulfillment_topup
         (job_id, order_id, option_api_id, supplier_id, topup_id, status, iccid, webhook_payload)
       VALUES ($1, $2::uuid, $3, $4, $5, 'iccid_ready', $6, $7::jsonb)
       ON CONFLICT (supplier_id, topup_id) DO NOTHING`,
      [
        jobId,
        input.order_id,
        line!.option_api_id,
        USIMSA_SUPPLIER_ID,
        topupId,
        iccid,
        JSON.stringify({ fulfillment_kind: "usim", admin_activated: true, admin_id: input.admin_id }),
      ],
    );

    await client2.query(
      `UPDATE bongsim_fulfillment_job
          SET supplier_id = COALESCE(supplier_id, $2),
              supplier_order_ref = COALESCE(supplier_order_ref, $3),
              updated_at = now()
        WHERE job_id = $1`,
      [jobId, USIMSA_SUPPLIER_ID, order!.order_number],
    );

    const snapRaw = line!.snapshot;
    const snapObj =
      typeof snapRaw === "object" && snapRaw ? { ...(snapRaw as Record<string, unknown>) } : {};
    const prevIccids = Array.isArray(snapObj.customer_iccids)
      ? snapObj.customer_iccids.map((v) => String(v))
      : [];
    if (!prevIccids.includes(iccid)) prevIccids.push(iccid);
    snapObj.fulfillment_mode = "usim";
    snapObj.customer_iccids = prevIccids;

    await client2.query(
      `UPDATE bongsim_order_line SET snapshot = $2::jsonb WHERE line_id = $1::uuid`,
      [line!.line_id, JSON.stringify(snapObj)],
    );

    await promoteFulfillmentJobIfReady(client2, jobId);

    await appendFulfillmentEvent(client2, input.order_id, jobId, "admin_usim_activated", {
      option_api_id: line!.option_api_id,
      iccid,
      topup_id: topupId,
      admin_id: input.admin_id,
      canceled_esim_topup_id: esimTopupToCancel,
    });

    await client2.query("COMMIT");

    return {
      ok: true,
      topup_id: topupId,
      iccid,
      ...(esimTopupToCancel ? { canceled_esim_topup_id: esimTopupToCancel } : {}),
    };
  } catch (e) {
    try {
      await client2.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[admin-usim-activate] persist", e);
    return { ok: false, reason: "db_error", message: "활성화 결과 저장 중 오류가 발생했습니다." };
  } finally {
    client2.release();
  }
}
