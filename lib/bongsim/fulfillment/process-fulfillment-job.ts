import type { PoolClient } from "pg";
import { getDefaultSupplierClient, isAsyncSupplier } from "@/lib/bongsim/supplier/supplier-client-registry";
import type { BongsimSupplierClient, BongsimSupplierOrderLineInput, BongsimSupplierSubmitResult } from "@/lib/bongsim/supplier/supplier-types";

type FulfillmentJobRow = {
  job_id: string;
  order_id: string;
  status: string;
  attempt_count: number;
  supplier_id: string | null;
  supplier_order_ref: string | null;
  supplier_submission_id: string | null;
  supplier_profile_ref: string | null;
  supplier_iccid: string | null;
  delivered_at: Date | null;
};

type OrderLineRow = {
  option_api_id: string;
  quantity: number;
  snapshot: unknown;
  line_total_krw: string;
};

type OrderRow = {
  order_id: string;
  order_number: string;
  status: string;
};

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

function deriveProfileFromSubmission(submissionId: string): { profile_ref: string; iccid: string } {
  const tail = submissionId.replace(/[^a-fA-F0-9]/g, "").slice(-12).padEnd(12, "0");
  return {
    profile_ref: `mock_prof_${tail.slice(0, 8)}`,
    iccid: `8901${tail}`,
  };
}

async function selectActiveJobForUpdate(
  client: PoolClient,
  orderId: string,
): Promise<FulfillmentJobRow | null> {
  const r = await client.query<FulfillmentJobRow>(
    `SELECT job_id, order_id, status, attempt_count,
            supplier_id, supplier_order_ref,
            supplier_submission_id, supplier_profile_ref, supplier_iccid,
            delivered_at
     FROM bongsim_fulfillment_job
     WHERE order_id = $1
       AND status IN ('queued', 'in_progress', 'submitted', 'acknowledged', 'profile_issued')
     LIMIT 1
     FOR UPDATE`,
    [orderId],
  );
  return r.rows[0] ?? null;
}

async function insertQueuedJob(client: PoolClient, orderId: string): Promise<FulfillmentJobRow | null> {
  try {
    const ins = await client.query<FulfillmentJobRow>(
      `INSERT INTO bongsim_fulfillment_job (order_id, status, attempt_count)
       VALUES ($1, 'queued', 0)
       RETURNING job_id, order_id, status, attempt_count,
                 supplier_id, supplier_order_ref,
                 supplier_submission_id, supplier_profile_ref, supplier_iccid,
                 delivered_at`,
      [orderId],
    );
    return ins.rows[0] ?? null;
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === "23505") {
      return await selectActiveJobForUpdate(client, orderId);
    }
    throw e;
  }
}

async function getOrCreateActiveJob(client: PoolClient, orderId: string): Promise<FulfillmentJobRow> {
  const existing = await selectActiveJobForUpdate(client, orderId);
  if (existing) return existing;
  const created = await insertQueuedJob(client, orderId);
  if (created) return created;
  const again = await selectActiveJobForUpdate(client, orderId);
  if (!again) throw new Error("fulfillment_job_missing");
  return again;
}

/**
 * 결제 완료된 주문을 공급사 submit까지 진행.
 *
 * 공급사 타입별 분기:
 *   - mock (동기형): submit → profile/iccid 즉시 수신 → delivered까지 일괄 전진.
 *   - usimsa (비동기형): submit → topup 행 N개 insert → job `submitted` 상태로 정지.
 *                        ICCID는 웹훅으로 개별 도착. delivered 승격은 webhook-parser가 담당.
 *
 * 멱등:
 *   이미 submitted/delivered 상태면 재실행 시 no-op.
 *
 * 주의 (비동기형):
 *   USIMSA HTTP 호출이 현재 트랜잭션 내에 있어서 커넥션을 오래 잡을 수 있음.
 *   운영 스케일 발생 시 outbox runner에서 트랜잭션을 분리하는 리팩토링 고려.
 */
export async function advanceFulfillmentForPaidOrder(
  client: PoolClient,
  orderId: string,
): Promise<void> {
  const o = await client.query<OrderRow>(
    `SELECT order_id, order_number, status FROM bongsim_order WHERE order_id = $1 FOR UPDATE`,
    [orderId],
  );
  const order = o.rows[0];
  if (!order || order.status !== "paid") return;

  const done = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bongsim_fulfillment_job WHERE order_id = $1 AND status = 'delivered'`,
    [orderId],
  );
  if (Number.parseInt(done.rows[0]?.n ?? "0", 10) > 0) return;

  const linesRes = await client.query<OrderLineRow>(
    `SELECT option_api_id, quantity, snapshot, line_total_krw
       FROM bongsim_order_line
      WHERE order_id = $1
      ORDER BY created_at ASC`,
    [orderId],
  );
  const lines: BongsimSupplierOrderLineInput[] = linesRes.rows.map((row) => ({
    option_api_id: row.option_api_id,
    quantity: row.quantity,
    snapshot:
      typeof row.snapshot === "object" && row.snapshot
        ? (row.snapshot as Record<string, unknown>)
        : {},
  }));

  const job = await getOrCreateActiveJob(client, orderId);
  const supplier = getDefaultSupplierClient();

  if (job.status === "delivered" || job.status === "failed") return;

  if (isAsyncSupplier(supplier.id)) {
    await advanceAsyncSupplier(client, order, job, lines, supplier);
  } else {
    await advanceSyncMockSupplier(client, order, job, lines, supplier);
  }
}

/**
 * 비동기 공급사 (USIMSA 등).
 *
 * queued → submit 호출 → topup 행 N개 insert → submitted로 세팅.
 * 이후 상태 전진(delivered/failed)은 webhook-parser가 담당.
 *
 * 이미 submitted 이상이면 no-op (웹훅이 달려가는 중).
 */
async function advanceAsyncSupplier(
  client: PoolClient,
  order: OrderRow,
  jobIn: FulfillmentJobRow,
  lines: BongsimSupplierOrderLineInput[],
  supplier: BongsimSupplierClient,
): Promise<void> {
  if (jobIn.status !== "queued" && jobIn.status !== "in_progress") {
    return; // submitted 이상은 웹훅 대기 중
  }

  // 이미 topup이 만들어져 있으면 재제출 방지
  const existing = await client.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM bongsim_fulfillment_topup WHERE job_id = $1`,
    [jobIn.job_id],
  );
  if (Number.parseInt(existing.rows[0]?.n ?? "0", 10) > 0) {
    // topup은 있는데 job status가 queued/in_progress면 비정상 — submitted로 정정
    await client.query(
      `UPDATE bongsim_fulfillment_job
         SET status = 'submitted',
             supplier_id = COALESCE(supplier_id, $2),
             supplier_order_ref = COALESCE(supplier_order_ref, $3),
             updated_at = now()
       WHERE job_id = $1`,
      [jobIn.job_id, supplier.id, order.order_number],
    );
    return;
  }

  let result: BongsimSupplierSubmitResult;
  try {
    result = await supplier.submitPaidOrder({
      order_id: order.order_id,
      order_number: order.order_number,
      lines,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await client.query(
      `UPDATE bongsim_fulfillment_job
         SET status = 'failed',
             supplier_id = COALESCE(supplier_id, $2),
             supplier_order_ref = COALESCE(supplier_order_ref, $3),
             attempt_count = attempt_count + 1,
             last_error = $4::jsonb,
             updated_at = now()
       WHERE job_id = $1`,
      [
        jobIn.job_id,
        supplier.id,
        order.order_number,
        JSON.stringify({ code: "async_supplier_submit_failed", message }),
      ],
    );
    await appendFulfillmentEvent(client, order.order_id, jobIn.job_id, "async_submit_error", {
      supplier: supplier.id,
      message,
    });
    return;
  }

  if (!result.topups || result.topups.length === 0) {
    // 비동기 공급사인데 topups 없음 → 계약 위반
    await client.query(
      `UPDATE bongsim_fulfillment_job
         SET status = 'failed',
             supplier_id = COALESCE(supplier_id, $2),
             supplier_order_ref = COALESCE(supplier_order_ref, $3),
             last_error = $4::jsonb,
             updated_at = now()
       WHERE job_id = $1`,
      [
        jobIn.job_id,
        supplier.id,
        order.order_number,
        JSON.stringify({ code: "async_supplier_no_topups" }),
      ],
    );
    await appendFulfillmentEvent(client, order.order_id, jobIn.job_id, "async_submit_no_topups", {
      supplier: supplier.id,
    });
    return;
  }

  // topup 행 N개 insert (UNIQUE 제약으로 중복 자동 차단)
  for (const topup of result.topups) {
    await client.query(
      `INSERT INTO bongsim_fulfillment_topup
         (job_id, order_id, option_api_id, supplier_id, topup_id, status)
       VALUES ($1, $2, $3, $4, $5, 'issued_topup')
       ON CONFLICT (supplier_id, topup_id) DO NOTHING`,
      [jobIn.job_id, order.order_id, topup.option_api_id, supplier.id, topup.topup_id],
    );
  }

  // job 집계 세팅 + submitted로 전환
  await client.query(
    `UPDATE bongsim_fulfillment_job
       SET status = 'submitted',
           supplier_id = $2,
           supplier_order_ref = $3,
           supplier_submission_id = $4,
           submission_response = $5::jsonb,
           submitted_at = now(),
           attempt_count = attempt_count + 1,
           updated_at = now()
     WHERE job_id = $1`,
    [
      jobIn.job_id,
      supplier.id,
      order.order_number,
      result.submission_id,
      JSON.stringify({ topups: result.topups }),
    ],
  );

  await appendFulfillmentEvent(client, order.order_id, jobIn.job_id, "async_submitted", {
    supplier: supplier.id,
    submission_id: result.submission_id,
    topup_count: result.topups.length,
  });
}

/**
 * 동기 mock 공급사.
 * 기존 while 루프 로직 유지 — queued → submitted → acknowledged → profile_issued → delivered.
 */
async function advanceSyncMockSupplier(
  client: PoolClient,
  order: OrderRow,
  jobIn: FulfillmentJobRow,
  lines: BongsimSupplierOrderLineInput[],
  supplier: BongsimSupplierClient,
): Promise<void> {
  let job = jobIn;

  const reload = async () => {
    const r = await client.query<FulfillmentJobRow>(
      `SELECT job_id, order_id, status, attempt_count,
              supplier_id, supplier_order_ref,
              supplier_submission_id, supplier_profile_ref, supplier_iccid,
              delivered_at
         FROM bongsim_fulfillment_job
        WHERE job_id = $1
        FOR UPDATE`,
      [job.job_id],
    );
    job = r.rows[0] ?? job;
  };

  let guard = 0;
  while (job.status !== "delivered" && job.status !== "failed" && guard < 24) {
    guard += 1;
    if (job.status === "queued") {
      try {
        const sub = await supplier.submitPaidOrder({
          order_id: order.order_id,
          order_number: order.order_number,
          lines,
        });
        await client.query(
          `UPDATE bongsim_fulfillment_job
             SET status = 'submitted',
                 supplier_submission_id = $2,
                 attempt_count = attempt_count + 1,
                 updated_at = now()
           WHERE job_id = $1`,
          [job.job_id, sub.submission_id],
        );
        await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_submitted", {
          submission_id: sub.submission_id,
          supplier: supplier.id,
        });
      } catch {
        await client.query(
          `UPDATE bongsim_fulfillment_job
             SET status = 'failed', last_error = $2::jsonb, updated_at = now()
           WHERE job_id = $1`,
          [job.job_id, JSON.stringify({ code: "mock_supplier_submit_failed" })],
        );
        await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_submit_error", {});
        break;
      }
      await reload();
      continue;
    }

    if (job.status === "submitted") {
      await client.query(
        `UPDATE bongsim_fulfillment_job SET status = 'acknowledged', updated_at = now() WHERE job_id = $1`,
        [job.job_id],
      );
      await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_acknowledged", {});
      await reload();
      continue;
    }

    if (job.status === "acknowledged") {
      const sid = job.supplier_submission_id ?? "";
      const derived = deriveProfileFromSubmission(sid || job.job_id);
      await client.query(
        `UPDATE bongsim_fulfillment_job
           SET status = 'profile_issued',
               supplier_profile_ref = COALESCE(supplier_profile_ref, $2),
               supplier_iccid = COALESCE(supplier_iccid, $3),
               updated_at = now()
         WHERE job_id = $1`,
        [job.job_id, derived.profile_ref, derived.iccid],
      );
      await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_profile_issued", {
        profile_ref: derived.profile_ref,
        iccid: derived.iccid,
      });
      await reload();
      continue;
    }

    if (job.status === "profile_issued") {
      await client.query(
        `UPDATE bongsim_fulfillment_job
           SET status = 'delivered', delivered_at = COALESCE(delivered_at, now()), updated_at = now()
         WHERE job_id = $1`,
        [job.job_id],
      );
      await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_delivered", {});
      await reload();
      break;
    }

    if (job.status === "in_progress") {
      await client.query(
        `UPDATE bongsim_fulfillment_job SET status = 'submitted', updated_at = now() WHERE job_id = $1`,
        [job.job_id],
      );
      await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_promoted_in_progress_to_submitted", {});
      await reload();
      continue;
    }

    await client.query(
      `UPDATE bongsim_fulfillment_job SET status = 'failed', last_error = $2::jsonb, updated_at = now() WHERE job_id = $1`,
      [job.job_id, JSON.stringify({ code: "unknown_job_status", status: job.status })],
    );
    await appendFulfillmentEvent(client, order.order_id, job.job_id, "mock_failed", { status: job.status });
    break;
  }
}
