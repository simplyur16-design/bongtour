import { verifyAndCapturePortonePayment } from "@/lib/simplyur/payments/complete-portone-capture";
import { isSimplyurPortonePaymentId } from "@/lib/simplyur/payments/portone-methods";
import { parseSimplyurPortoneWebhook } from "@/lib/simplyur/payments/portone-webhook-verify";

// REGRESSION-FREEZE[simplyur-portone-overseas-pg]: PortOne V2 webhook (PayPal / KICC async) — manifest
// REGRESSION-FREEZE[simplyur-portone-webhook-secret]: signature verify when PORTONE_WEBHOOK_SECRET set — manifest

const PAID_TYPES = new Set(["Transaction.Paid"]);

export async function POST(req: Request) {
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(null, { status: 400 });
  }

  const parsed = await parseSimplyurPortoneWebhook(rawBody, req.headers);
  if (!parsed.ok) {
    const status = parsed.reason === "invalid_signature" ? 401 : 400;
    return new Response(null, { status });
  }

  if (!PAID_TYPES.has(parsed.type)) {
    return new Response(null, { status: 200 });
  }

  const paymentId = parsed.paymentId ?? "";
  if (!paymentId || !isSimplyurPortonePaymentId(paymentId)) {
    return new Response(null, { status: 200 });
  }

  const fin = await verifyAndCapturePortonePayment({ paymentId });
  if (!fin.ok && fin.error !== "payment_not_paid") {
    console.warn("[simplyur:portone:webhook]", {
      paymentId,
      error: fin.error,
      status: fin.status,
      verified: parsed.verified,
    });
  }

  return new Response(null, { status: 200 });
}
