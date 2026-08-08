import {
  callEximbayPaymentsVerify,
  eximbayStatusUrlAckBody,
  isEximbayPayerAuthStatus,
  parseEximbayStatusQuery,
} from "@/lib/simplyur/payments/eximbay-verify";
import { storeEximbayPayerAuthId } from "@/lib/simplyur/payments/eximbay-payer-auth-store";
import { processEximbayPaymentOutcome } from "@/lib/simplyur/payments/process-eximbay-payment-outcome";

// REGRESSION-FREEZE[simplyur-eximbay-payment-prep]: status_url webhook + verify — manifest
// REGRESSION-FREEZE[simplyur-eximbay-live-checkout]: verify → OrderPaid — manifest
// REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: PAYER_AUTH store before confirm — manifest

async function extractStatusQueryString(req: Request): Promise<string> {
  const url = new URL(req.url);
  if (url.search && url.search.length > 1) {
    return url.search.slice(1);
  }

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    return text.trim();
  }
  if (contentType.includes("application/json")) {
    try {
      const json = (await req.json()) as { data?: unknown };
      if (typeof json.data === "string") return json.data.trim();
    } catch {
      /* fall through */
    }
  }

  try {
    const text = await req.text();
    if (text.includes("=")) return text.trim();
  } catch {
    /* empty */
  }
  return "";
}

async function handleStatus(req: Request): Promise<Response> {
  let data: string;
  try {
    data = await extractStatusQueryString(req);
  } catch {
    return new Response(eximbayStatusUrlAckBody(false, "bad_body"), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (!data) {
    return new Response(eximbayStatusUrlAckBody(false, "empty"), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const verified = await callEximbayPaymentsVerify(data);
  if (!verified.ok) {
    console.warn("[simplyur:eximbay:status]", {
      reason: verified.reason,
      rescode: verified.rescode,
      resmsg: verified.resmsg,
    });
    // ACK so Eximbay does not hammer failed verifies.
    return new Response(eximbayStatusUrlAckBody(true), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const parsed = parseEximbayStatusQuery(data);
  if (!parsed.orderId) {
    console.warn("[simplyur:eximbay:status] verified but no order_id in payload");
    return new Response(eximbayStatusUrlAckBody(true), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // Auth-only: stash payer_auth_id for mobile complete-pa (do not mark paid).
  if (isEximbayPayerAuthStatus(parsed) && parsed.payerAuthId) {
    const stored = await storeEximbayPayerAuthId({
      eximbayOrderId: parsed.orderId,
      payerAuthId: parsed.payerAuthId,
    });
    console.info("[simplyur:eximbay:status:payer_auth]", {
      ok: stored.ok,
      orderId: parsed.orderId,
    });
    return new Response(eximbayStatusUrlAckBody(true), {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const eventId = parsed.transactionId || `eximbay_status_${parsed.orderId}_${Date.now()}`;
  const outcome = await processEximbayPaymentOutcome({
    eximbayOrderId: parsed.orderId,
    providerEventId: eventId,
    rawPayload: { data, rescode: verified.rescode, resmsg: verified.resmsg },
  });

  if (!outcome.ok) {
    console.warn("[simplyur:eximbay:status:capture]", { reason: outcome.reason, orderId: parsed.orderId });
  } else {
    console.info("[simplyur:eximbay:status:paid]", {
      duplicate: outcome.duplicate,
      order_id: outcome.order_id,
      order_number: outcome.order_number,
    });
  }

  return new Response(eximbayStatusUrlAckBody(true), {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export async function POST(req: Request) {
  return handleStatus(req);
}

export async function GET(req: Request) {
  return handleStatus(req);
}
