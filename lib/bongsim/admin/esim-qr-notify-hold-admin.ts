import { getBongsimFulfillOutboxPool } from "@/lib/bongsim/db/pool";
import { ESIM_QR_NOTIFY_TOPIC } from "@/lib/bongsim/fulfillment/esim-qr-notify-outbox";
import { maskEsimNotifyPhone } from "@/lib/bongsim/fulfillment/esim-qr-notify-policy";

export type HeldEsimQrNotifyRow = {
  id: string;
  order_id: string | null;
  held_at: string | null;
  masked_phone: string | null;
  attempts: number | null;
};

function asRecord(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function toHeldEsimQrNotifyRow(row: { id: string; payload: unknown }): HeldEsimQrNotifyRow {
  const payload = asRecord(row.payload);
  const hold = asRecord(payload?._outbox_hold);
  const defer = asRecord(payload?._outbox_defer);
  const orderId = typeof payload?.order_id === "string" ? payload.order_id : null;
  const phone = typeof payload?.delivery_phone === "string" ? payload.delivery_phone : null;
  const attempts = typeof defer?.attempts === "number" ? defer.attempts : null;
  const heldAt = typeof hold?.held_at === "string" ? hold.held_at : null;
  return {
    id: row.id,
    order_id: orderId,
    held_at: heldAt,
    masked_phone: maskEsimNotifyPhone(phone),
    attempts,
  };
}

export async function listHeldEsimQrNotify(): Promise<HeldEsimQrNotifyRow[]> {
  const pool = getBongsimFulfillOutboxPool();
  if (!pool) return [];
  const r = await pool.query<{ id: string; payload: unknown }>(
    `SELECT id::text AS id, payload
       FROM bongsim_outbox
      WHERE topic = $1
        AND processed_at IS NULL
        AND payload->'_outbox_hold'->>'active' = 'true'
      ORDER BY available_at ASC
      LIMIT 100`,
    [ESIM_QR_NOTIFY_TOPIC],
  );
  return r.rows.map(toHeldEsimQrNotifyRow);
}

export async function releaseHeldEsimQrNotify(id: string): Promise<boolean> {
  const pool = getBongsimFulfillOutboxPool();
  if (!pool) return false;
  const outboxId = id.trim();
  if (!outboxId) return false;
  const r = await pool.query<{ id: string }>(
    `UPDATE bongsim_outbox
        SET payload = payload - '_outbox_hold',
            locked_at = NULL,
            available_at = now()
      WHERE id = $1::uuid
        AND topic = $2
        AND processed_at IS NULL
        AND payload->'_outbox_hold'->>'active' = 'true'
      RETURNING id::text AS id`,
    [outboxId, ESIM_QR_NOTIFY_TOPIC],
  );
  return Boolean(r.rows[0]?.id);
}
