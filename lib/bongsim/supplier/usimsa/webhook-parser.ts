import { getPgPool } from "@/lib/bongsim/db/pool";
import type { UsimsaWebhookPayload } from "@/lib/bongsim/supplier/usimsa/types";

const USIMSA_SUPPLIER_ID = "usimsa";

export type UsimsaWebhookResult =
  | {
      outcome: "applied";
      topup_id: string;
      topup_row_id: string;
      topup_status: string;
      job_promoted_to: string | null;
    }
  | { outcome: "skipped_unknown_topup"; topup_id: string }
  | { outcome: "invalid_payload"; reason: string }
  | { outcome: "database_unavailable" };

/** QR 이미지 URL (USIMSA 필드명 변형 호환). */
export function normalizeUsimsaQrCodeImgUrl(p: UsimsaWebhookPayload): string | null {
  return (p.qrcodeImgUrl ?? p.qrCodeImgUrl ?? null) || null;
}

function nonEmptyString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export function normalizeUsimsaWebhookPayload(
  raw: unknown,
): UsimsaWebhookPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const topupId = nonEmptyString(o.topupId);
  const optionId = nonEmptyString(o.optionId);
  if (!topupId || !optionId) return null;

  return {
    topupId,
    optionId,
    iccid: nonEmptyString(o.iccid) ?? undefined,
    smdp: nonEmptyString(o.smdp) ?? undefined,
    activateCode: nonEmptyString(o.activateCode) ?? undefined,
    downloadLink: nonEmptyString(o.downloadLink) ?? undefined,
    qrcodeImgUrl: nonEmptyString(o.qrcodeImgUrl) ?? undefined,
    qrCodeImgUrl: nonEmptyString(o.qrCodeImgUrl) ?? undefined,
    expiredDate: nonEmptyString(o.expiredDate) ?? undefined,
  };
}

/**
 * USIMSA 웹훅 수신 처리.
 *
 * 1) topup 행 업데이트 (COALESCE로 기존값 보존, terminal 상태면 불변)
 * 2) 자식 topup 집계 → job 상태 승격 판정:
 *    - 모든 topup이 iccid_ready + 일부 canceled: job → delivered
 *    - 일부라도 failed: job → failed
 *    - 아직 issued_topup 남음: job 그대로
 *
 * 멱등:
 *   같은 topupId로 중복 수신해도 terminal 상태 덮어쓰지 않음.
 *
 * 실패 정책:
 *   USIMSA는 재시도 없음 → 500 반환해도 유실.
 *   예외는 호출자(route)에서 swallow하고 200 반환.
 */
export async function handleUsimsaWebhook(
  raw: unknown,
): Promise<UsimsaWebhookResult> {
  const payload = normalizeUsimsaWebhookPayload(raw);
  if (!payload) {
    return { outcome: "invalid_payload", reason: "missing topupId/optionId" };
  }

  const pool = getPgPool();
  if (!pool) return { outcome: "database_unavailable" };

  // inbound 감사 로그는 best-effort.
  try {
    await pool.query(
      `INSERT INTO bongsim_supplier_api_log
         (supplier_id, direction, endpoint, request_body)
       VALUES ($1, 'inbound_webhook', '/api/usimsa/webhook', $2::jsonb)`,
      [USIMSA_SUPPLIER_ID, JSON.stringify(payload)],
    );
  } catch {
    /* 감사 로그 실패는 치명적 아님 */
  }

  const qrUrl = normalizeUsimsaQrCodeImgUrl(payload);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) topup 행 lock + lookup
    const lookup = await client.query<{
      topup_row_id: string;
      job_id: string;
      order_id: string;
    }>(
      `SELECT topup_row_id, job_id, order_id
         FROM bongsim_fulfillment_topup
        WHERE supplier_id = $1 AND topup_id = $2
        FOR UPDATE`,
      [USIMSA_SUPPLIER_ID, payload.topupId],
    );
    const row = lookup.rows[0];
    if (!row) {
      await client.query("ROLLBACK");
      return { outcome: "skipped_unknown_topup", topup_id: payload.topupId };
    }

    const nextStatus = payload.iccid ? "iccid_ready" : "issued_topup";

    // 2) topup 업데이트
    const upd = await client.query<{ status: string }>(
      `UPDATE bongsim_fulfillment_topup
         SET iccid               = COALESCE($2, iccid),
             smdp                = COALESCE($3, smdp),
             activate_code       = COALESCE($4, activate_code),
             download_link       = COALESCE($5, download_link),
             qr_code_img_url     = COALESCE($6, qr_code_img_url),
             expired_date        = COALESCE($7::date, expired_date),
             webhook_received_at = now(),
             webhook_payload     = $8::jsonb,
             status              = CASE
                                     WHEN status IN ('delivered', 'canceled') THEN status
                                     ELSE $9
                                   END,
             updated_at          = now()
       WHERE topup_row_id = $1
       RETURNING status`,
      [
        row.topup_row_id,
        payload.iccid ?? null,
        payload.smdp ?? null,
        payload.activateCode ?? null,
        payload.downloadLink ?? null,
        qrUrl,
        payload.expiredDate ?? null,
        JSON.stringify(payload),
        nextStatus,
      ],
    );
    const newTopupStatus = upd.rows[0]?.status ?? nextStatus;

    // 3) job 승격 판정
    const jobPromotedTo = await maybePromoteJob(client, row.job_id);

    await client.query("COMMIT");

    return {
      outcome: "applied",
      topup_id: payload.topupId,
      topup_row_id: row.topup_row_id,
      topup_status: newTopupStatus,
      job_promoted_to: jobPromotedTo,
    };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    client.release();
  }
}

/**
 * job 자식 topup들의 상태를 집계해서 job을 승격시킨다.
 * 반환: 승격된 새 상태 또는 null (변경 없음).
 *
 * 조건:
 *   - 모든 자식이 iccid_ready / canceled → delivered (iccid_ready는 delivered로 마킹)
 *   - 하나라도 failed → failed
 *   - 그 외 (issued_topup 잔존) → 변경 없음
 */
async function maybePromoteJob(
  client: import("pg").PoolClient,
  jobId: string,
): Promise<string | null> {
  const counts = await client.query<{
    total: string;
    ready: string;
    canceled: string;
    failed: string;
    delivered: string;
  }>(
    `SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE status = 'iccid_ready')::text AS ready,
       COUNT(*) FILTER (WHERE status = 'canceled')::text   AS canceled,
       COUNT(*) FILTER (WHERE status = 'failed')::text     AS failed,
       COUNT(*) FILTER (WHERE status = 'delivered')::text  AS delivered
     FROM bongsim_fulfillment_topup
     WHERE job_id = $1`,
    [jobId],
  );
  const c = counts.rows[0];
  if (!c) return null;

  const total = Number(c.total);
  const ready = Number(c.ready);
  const canceled = Number(c.canceled);
  const failed = Number(c.failed);
  const delivered = Number(c.delivered);

  if (total === 0) return null;

  // 현재 job 상태가 이미 terminal이면 변경 없음.
  const cur = await client.query<{ status: string }>(
    `SELECT status FROM bongsim_fulfillment_job WHERE job_id = $1 FOR UPDATE`,
    [jobId],
  );
  const curStatus = cur.rows[0]?.status;
  if (!curStatus) return null;
  if (curStatus === "delivered" || curStatus === "failed") return null;

  if (failed > 0 && ready + canceled + failed + delivered === total) {
    await client.query(
      `UPDATE bongsim_fulfillment_job
         SET status = 'failed', updated_at = now()
       WHERE job_id = $1`,
      [jobId],
    );
    return "failed";
  }

  if (ready + canceled + delivered === total && ready + delivered > 0) {
    // 남은 iccid_ready를 delivered로 승격
    await client.query(
      `UPDATE bongsim_fulfillment_topup
         SET status = 'delivered', updated_at = now()
       WHERE job_id = $1 AND status = 'iccid_ready'`,
      [jobId],
    );
    await client.query(
      `UPDATE bongsim_fulfillment_job
         SET status = 'delivered',
             delivered_at = COALESCE(delivered_at, now()),
             updated_at = now()
       WHERE job_id = $1`,
      [jobId],
    );
    return "delivered";
  }

  return null;
}
