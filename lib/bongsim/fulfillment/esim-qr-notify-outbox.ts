/**
 * eSIM QR 알림톡·LMS·메일 — Solapi 버스트 누락 방지용 순차 outbox.
 * REGRESSION-FREEZE[bongsim-esim-qr-notify-serialize]: EsimQrNotify outbox — manifest
 */
import type { PoolClient } from 'pg'
import { getPgPool } from '@/lib/bongsim/db/pool'
import { deferOrTerminalOutboxAfterFailure } from '@/lib/bongsim/fulfillment/outbox-defer'

export const ESIM_QR_NOTIFY_TOPIC = 'EsimQrNotify'

/** 발송 간격(ms). Solapi/카카오 순간 제한 회피. */
export const ESIM_QR_NOTIFY_GAP_MS = Math.max(
  400,
  Number.parseInt(process.env.BONGSIM_ESIM_QR_NOTIFY_GAP_MS ?? '1200', 10) || 1200,
)

/**
 * pick 후 네트워크 발송 전 커밋할 때 available_at을 밀어 동시 드레인(킥+크론)이
 * 같은 행을 두 번 Solapi로 보내지 않게 한다.
 * REGRESSION-FREEZE[bongsim-esim-qr-notify-serialize]: claim lease — manifest
 */
export const ESIM_QR_NOTIFY_CLAIM_LEASE_MS = Math.max(
  60_000,
  Number.parseInt(process.env.BONGSIM_ESIM_QR_NOTIFY_CLAIM_LEASE_MS ?? '900000', 10) || 900_000,
)

export type EsimQrNotifyPayload = {
  order_id: string
  order_number: string
  delivery_email: string
  delivery_phone: string | null
  qr_code_url: string
  download_link: string
  /** qty>1 — topup별 알림 멱등키·라벨 */
  topup_row_id?: string | null
  unit_index?: number | null
  unit_total?: number | null
}

/** order+topup 단위 멱등 — 한 주문 qty N이면 알림 N건 */
export function esimQrNotifyDedupeKey(orderId: string, topupRowId?: string | null): string {
  const oid = orderId.trim()
  const tid = (topupRowId ?? '').trim()
  return tid ? `bongsim:esim_qr_notify:${oid}:${tid}` : `bongsim:esim_qr_notify:${oid}`
}

/** pending N건이면 N * gap 만큼 뒤로 스케줄 */
export function computeEsimQrNotifyStaggerMs(pendingCount: number, gapMs = ESIM_QR_NOTIFY_GAP_MS): number {
  const n = Math.max(0, Math.trunc(pendingCount))
  return n * gapMs
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function parsePayload(raw: unknown): EsimQrNotifyPayload | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const order_id = typeof o.order_id === 'string' ? o.order_id.trim() : ''
  const order_number = typeof o.order_number === 'string' ? o.order_number.trim() : ''
  const delivery_email = typeof o.delivery_email === 'string' ? o.delivery_email.trim() : ''
  const delivery_phone =
    typeof o.delivery_phone === 'string' && o.delivery_phone.trim()
      ? o.delivery_phone.trim()
      : null
  const qr_code_url = typeof o.qr_code_url === 'string' ? o.qr_code_url.trim() : ''
  const download_link = typeof o.download_link === 'string' ? o.download_link.trim() : ''
  const topup_row_id =
    typeof o.topup_row_id === 'string' && o.topup_row_id.trim() ? o.topup_row_id.trim() : null
  const unit_index =
    typeof o.unit_index === 'number' && Number.isFinite(o.unit_index) ? Math.trunc(o.unit_index) : null
  const unit_total =
    typeof o.unit_total === 'number' && Number.isFinite(o.unit_total) ? Math.trunc(o.unit_total) : null
  if (!order_id || !qr_code_url || !download_link) return null
  return {
    order_id,
    order_number,
    delivery_email,
    delivery_phone,
    qr_code_url,
    download_link,
    topup_row_id,
    unit_index,
    unit_total,
  }
}

export async function enqueueEsimQrNotify(input: EsimQrNotifyPayload): Promise<{ enqueued: boolean }> {
  const pool = getPgPool()
  if (!pool) return { enqueued: false }

  const payload: EsimQrNotifyPayload = {
    order_id: input.order_id.trim(),
    order_number: input.order_number.trim(),
    delivery_email: input.delivery_email.trim(),
    delivery_phone: input.delivery_phone?.trim() || null,
    qr_code_url: input.qr_code_url.trim(),
    download_link: input.download_link.trim(),
    topup_row_id: input.topup_row_id?.trim() || null,
    unit_index: input.unit_index ?? null,
    unit_total: input.unit_total ?? null,
  }
  if (!payload.order_id || !payload.qr_code_url || !payload.download_link) {
    return { enqueued: false }
  }

  const dedupe = esimQrNotifyDedupeKey(payload.order_id, payload.topup_row_id)
  const r = await pool.query<{ id: string }>(
    `WITH pending AS (
       SELECT COUNT(*)::int AS n
         FROM bongsim_outbox
        WHERE topic = $1
          AND processed_at IS NULL
          AND dedupe_key <> $3
     )
     INSERT INTO bongsim_outbox (topic, payload, dedupe_key, available_at)
     SELECT $1, $2::jsonb, $3,
            now() + ((SELECT n FROM pending) * $4::int) * interval '1 millisecond'
     ON CONFLICT (dedupe_key) DO UPDATE SET
       payload = EXCLUDED.payload,
       available_at = CASE
         WHEN bongsim_outbox.processed_at IS NULL THEN bongsim_outbox.available_at
         ELSE EXCLUDED.available_at
       END,
       processed_at = CASE
         WHEN bongsim_outbox.processed_at IS NOT NULL
              AND COALESCE(bongsim_outbox.payload->'_outbox_defer'->>'terminal', 'false') = 'true'
         THEN NULL
         ELSE bongsim_outbox.processed_at
       END,
       locked_at = CASE
         WHEN bongsim_outbox.processed_at IS NOT NULL
              AND COALESCE(bongsim_outbox.payload->'_outbox_defer'->>'terminal', 'false') = 'true'
         THEN NULL
         ELSE bongsim_outbox.locked_at
       END
     RETURNING id`,
    [ESIM_QR_NOTIFY_TOPIC, JSON.stringify(payload), dedupe, ESIM_QR_NOTIFY_GAP_MS],
  )

  return { enqueued: Boolean(r.rows[0]?.id) }
}

async function deferNotifyFailure(
  client: PoolClient,
  input: { outbox_id: string; payload: unknown; reason: string; err?: unknown },
): Promise<'deferred' | 'terminal'> {
  // Solapi 순간 제한 — 분 단위보다 초 단위 백오프
  const prev =
    input.payload && typeof input.payload === 'object'
      ? ((input.payload as Record<string, unknown>)._outbox_defer as { attempts?: number } | undefined)
      : undefined
  const attempts = (prev?.attempts ?? 0) + 1
  if (attempts >= 5) {
    // attempts already counted above — force terminal via max attempts path
    const forced = {
      ...(input.payload && typeof input.payload === 'object'
        ? (input.payload as Record<string, unknown>)
        : {}),
      _outbox_defer: { attempts: 4, reason: input.reason },
    }
    return deferOrTerminalOutboxAfterFailure(client, {
      outbox_id: input.outbox_id,
      payload: forced,
      reason: input.reason,
      err: input.err,
    })
  }

  const backoffSec = Math.min(180, 20 * attempts)
  const errMsg =
    input.err instanceof Error ? input.err.message : input.err != null ? String(input.err) : undefined
  const base =
    input.payload && typeof input.payload === 'object'
      ? { ...(input.payload as Record<string, unknown>) }
      : {}
  await client.query(
    `UPDATE bongsim_outbox
     SET available_at = now() + ($2::int * interval '1 second'),
         locked_at = now(),
         payload = $3::jsonb
     WHERE id = $1`,
    [
      input.outbox_id,
      backoffSec,
      JSON.stringify({
        ...base,
        _outbox_defer: {
          attempts,
          reason: input.reason,
          last_error: errMsg,
        },
      }),
    ],
  )
  console.error('[bongsim:esim-qr-notify:deferred]', {
    outbox_id: input.outbox_id,
    attempts,
    backoff_sec: backoffSec,
    reason: input.reason,
  })
  return 'deferred'
}

export type ProcessEsimQrNotifyResult =
  | { outcome: 'empty' }
  | { outcome: 'processed'; order_id: string }
  | { outcome: 'deferred' | 'terminal' | 'error'; order_id?: string }

export async function processNextEsimQrNotifyOutbox(): Promise<ProcessEsimQrNotifyResult> {
  const pool = getPgPool()
  if (!pool) return { outcome: 'error' }

  const client = await pool.connect()
  let pickedId: string | null = null
  let rawPayload: unknown = null
  let parsed: EsimQrNotifyPayload | null = null

  try {
    await client.query('BEGIN')
    const pick = await client.query<{ id: string; payload: unknown }>(
      `SELECT id, payload
         FROM bongsim_outbox
        WHERE topic = $1
          AND processed_at IS NULL
          AND available_at <= now()
        ORDER BY available_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED`,
      [ESIM_QR_NOTIFY_TOPIC],
    )
    const row = pick.rows[0]
    if (!row) {
      await client.query('COMMIT')
      return { outcome: 'empty' }
    }
    pickedId = row.id
    rawPayload = row.payload
    parsed = parsePayload(row.payload)
    if (!parsed) {
      await deferNotifyFailure(client, {
        outbox_id: row.id,
        payload: row.payload,
        reason: 'invalid_payload',
      })
      await client.query('COMMIT')
      return { outcome: 'terminal', order_id: undefined }
    }

    // 발송 전 커밋 해제 — 네트워크 대기 중 행 락 유지 금지.
    // 단 available_at lease로 다른 드레인이 같은 행을 집어 이중 알림톡 내지 않게 한다.
    await client.query(
      `UPDATE bongsim_outbox
          SET locked_at = now(),
              available_at = now() + ($2::int * interval '1 millisecond')
        WHERE id = $1`,
      [row.id, ESIM_QR_NOTIFY_CLAIM_LEASE_MS],
    )
    await client.query('COMMIT')
  } catch (e) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    client.release()
    console.error('[bongsim:esim-qr-notify:pick]', e)
    return { outcome: 'error' }
  }

  client.release()

  if (!pickedId || !parsed) return { outcome: 'error' }

  try {
    const { sendQueuedEsimQrCustomerNotify } = await import('@/lib/bongsim/fulfillment/esim-delivery')
    await sendQueuedEsimQrCustomerNotify(parsed)

    const pool2 = getPgPool()
    if (!pool2) return { outcome: 'error', order_id: parsed.order_id }
    await pool2.query(
      `UPDATE bongsim_outbox SET processed_at = now(), locked_at = now() WHERE id = $1`,
      [pickedId],
    )
    return { outcome: 'processed', order_id: parsed.order_id }
  } catch (e) {
    const pool2 = getPgPool()
    if (!pool2) return { outcome: 'error', order_id: parsed.order_id }
    const c2 = await pool2.connect()
    try {
      await c2.query('BEGIN')
      const d = await deferNotifyFailure(c2, {
        outbox_id: pickedId,
        payload: rawPayload,
        reason: 'notify_send_failed',
        err: e,
      })
      await c2.query('COMMIT')
      return { outcome: d, order_id: parsed.order_id }
    } catch (e2) {
      try {
        await c2.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      console.error('[bongsim:esim-qr-notify:defer]', e2)
      return { outcome: 'error', order_id: parsed.order_id }
    } finally {
      c2.release()
    }
  }
}

export async function drainEsimQrNotifyOutboxBestEffort(maxRounds = 24): Promise<{
  processed: number
  deferred: number
}> {
  let processed = 0
  let deferred = 0
  for (let i = 0; i < maxRounds; i += 1) {
    const r = await processNextEsimQrNotifyOutbox()
    if (r.outcome === 'empty') break
    if (r.outcome === 'processed') {
      processed += 1
      await sleep(ESIM_QR_NOTIFY_GAP_MS)
      continue
    }
    if (r.outcome === 'deferred' || r.outcome === 'terminal') {
      deferred += 1
      continue
    }
    /* error — stop burst to avoid tight loop */
    break
  }
  return { processed, deferred }
}

/** 웹훅·일괄 발급 직후 — 요청을 막지 않고 백그라운드 순차 발송 */
export function kickEsimQrNotifyDrain(maxRounds = 32): void {
  void drainEsimQrNotifyOutboxBestEffort(maxRounds).catch((e) => {
    console.warn('[bongsim:esim-qr-notify:kick]', e)
  })
}

export async function countPendingEsimQrNotify(): Promise<number> {
  const pool = getPgPool()
  if (!pool) return 0
  const r = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n
       FROM bongsim_outbox
      WHERE topic = $1 AND processed_at IS NULL`,
    [ESIM_QR_NOTIFY_TOPIC],
  )
  return r.rows[0]?.n ?? 0
}
