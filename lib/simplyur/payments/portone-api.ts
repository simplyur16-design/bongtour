import { PORTONE_API_ORIGIN, resolvePortoneEnv } from "@/lib/simplyur/payments/portone-env";

export type PortonePaymentSnapshot = {
  paymentId: string;
  status: string;
  totalAmount: number;
  currency: string;
  txId: string | null;
};

function parseTotalAmount(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.trunc(raw);
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.total === "number") return Math.trunc(o.total);
  }
  return null;
}

function normalizeCurrency(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/^CURRENCY_/, "").toUpperCase();
}

/** Server-side PortOne payment lookup (never expose secret to client). */
export async function fetchPortonePaymentSnapshot(paymentId: string): Promise<PortonePaymentSnapshot | null> {
  const resolved = resolvePortoneEnv();
  if (!resolved.ok) return null;

  const res = await fetch(`${PORTONE_API_ORIGIN}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: `PortOne ${resolved.env.apiSecret}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const root = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const payment = (root.payment && typeof root.payment === "object" ? root.payment : root) as Record<
    string,
    unknown
  >;

  const status = typeof payment.status === "string" ? payment.status : "";
  const totalAmount = parseTotalAmount(payment.amount ?? payment.totalAmount);
  if (!status || totalAmount == null) return null;

  const txId =
    typeof payment.transactionId === "string"
      ? payment.transactionId
      : typeof payment.txId === "string"
        ? payment.txId
        : null;

  return {
    paymentId,
    status,
    totalAmount,
    currency: normalizeCurrency(payment.currency),
    txId,
  };
}

export function isPortonePaidStatus(status: string): boolean {
  return status.trim().toUpperCase() === "PAID";
}
