import { NextResponse } from "next/server";
import { processMockPaymentWebhook } from "@/lib/bongsim/data/process-payment-webhook";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseMockWebhookBody } from "@/lib/bongsim/payments/webhook/mock-webhook-adapter";
import { isPaymentWebhookProviderSupported, verifyPaymentWebhookHeaders } from "@/lib/bongsim/payments/webhook/webhook-verifier-registry";
import { isNodeProduction } from "@/lib/bongsim/runtime/node-env";

type Ctx = { params: { provider: string } };

export async function POST(req: Request, ctx: Ctx) {
  const { provider } = ctx.params;
  if (!getPgPool()) {
    return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "db_unconfigured" }, { status: 503 });
  }

  if (!isPaymentWebhookProviderSupported(provider)) {
    return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "unknown_provider" }, { status: 400 });
  }

  if (isNodeProduction() && !process.env.BONGSIM_MOCK_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json(
      { schema: "bongsim.payment_webhook.error.v1", ok: false, error: "mock_webhook_secret_unconfigured" },
      { status: 503 },
    );
  }

  if (!verifyPaymentWebhookHeaders(provider, req.headers)) {
    return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = parseMockWebhookBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: parsed.error }, { status: 400 });
  }

  const res = await processMockPaymentWebhook(parsed.event);
  if (!res.ok) {
    if (res.reason === "unknown_attempt") {
      return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "unknown_attempt" }, { status: 404 });
    }
    if (res.reason === "db_unconfigured") {
      return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "db_unconfigured" }, { status: 503 });
    }
    return NextResponse.json({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "db_error" }, { status: 500 });
  }

  const ack = {
    schema: "bongsim.payment_webhook.ack.v1" as const,
    ok: true as const,
    ...(res.duplicate ? { duplicate: true as const } : {}),
  };
  return NextResponse.json(ack, { status: 200 });
}
