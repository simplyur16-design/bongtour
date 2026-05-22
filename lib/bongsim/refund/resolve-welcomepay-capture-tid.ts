import type { Pool, PoolClient } from "pg";
import { WELCOMEPAY_PROVIDER_ID } from "@/lib/bongsim/data/process-welcomepay-payment-outcome";

const TID_KEYS = ["TID", "tid", "P_TID", "p_tid"] as const;

/** 승인 TID — `authToken` 등 인증 토큰은 제외 (취소 API TID 아님). */
export function isPlausibleWelcomepayCaptureTid(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 20) return false;
  if (s.startsWith("welcomepay_") || s.startsWith("oid_") || s.startsWith("mock_")) return false;
  if (/^[a-f0-9]{40}$/i.test(s)) return false;
  return true;
}

export function pickCaptureTidFromMap(m: Record<string, string>): string {
  for (const key of TID_KEYS) {
    const v = (m[key] ?? "").trim();
    if (isPlausibleWelcomepayCaptureTid(v)) return v;
  }
  return "";
}

function collectStringMaps(node: unknown, out: Record<string, string>[], depth: number): void {
  if (depth > 6 || node == null) return;
  if (typeof node === "object" && !Array.isArray(node)) {
    const flat: Record<string, string> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (v != null && typeof v !== "object") flat[k] = String(v);
    }
    if (Object.keys(flat).length) out.push(flat);
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectStringMaps(v, out, depth + 1);
    }
  }
}

export function extractCaptureTidFromPayload(payload: unknown): string {
  const maps: Record<string, string>[] = [];
  collectStringMaps(payload, maps, 0);
  for (const m of maps) {
    const tid = pickCaptureTidFromMap(m);
    if (tid) return tid;
  }
  return "";
}

async function loadTidFromProviderEvents(
  db: Pool | PoolClient,
  orderId: string,
): Promise<string | null> {
  const r = await db.query<{ payload_json: unknown }>(
    `SELECT payload_json
       FROM bongsim_payment_provider_event
      WHERE order_id = $1::uuid AND provider = $2
      ORDER BY created_at DESC
      LIMIT 30`,
    [orderId, WELCOMEPAY_PROVIDER_ID],
  );
  for (const row of r.rows) {
    const tid = extractCaptureTidFromPayload(row.payload_json);
    if (tid) return tid;
  }
  return null;
}

/** DB `payment_reference` 또는 과거 PG 이벤트 payload에서 승인 TID 복원 */
export async function resolveWelcomepayCaptureTid(
  db: Pool | PoolClient,
  orderId: string,
  paymentReference: string | null,
): Promise<string | null> {
  const ref = (paymentReference ?? "").trim();
  if (isPlausibleWelcomepayCaptureTid(ref)) return ref;
  return loadTidFromProviderEvents(db, orderId);
}
