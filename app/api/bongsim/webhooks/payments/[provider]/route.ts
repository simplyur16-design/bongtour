import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { processMockPaymentWebhook } from "@/lib/bongsim/data/process-payment-webhook";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { parseMockWebhookBody } from "@/lib/bongsim/payments/webhook/mock-webhook-adapter";
import { isPaymentWebhookProviderSupported, verifyPaymentWebhookHeaders } from "@/lib/bongsim/payments/webhook/webhook-verifier-registry";
import { isNodeProduction } from "@/lib/bongsim/runtime/node-env";

type Ctx = { params: Promise<{ provider: string }> };

export async function POST(req: Request, routeCtx: Ctx) {
  const { provider } = await routeCtx.params;
  const leakCtx = `bongsim.webhooks.payments.${provider}`;

  if (!getPgPool()) {
    return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "db_unconfigured" }, leakCtx, {
      status: 503,
    });
  }

  if (!isPaymentWebhookProviderSupported(provider)) {
    return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "unknown_provider" }, leakCtx, {
      status: 400,
    });
  }

  if (isNodeProduction() && !process.env.BONGSIM_MOCK_WEBHOOK_SECRET?.trim()) {
    return jsonWithLeakGuard(
      { schema: "bongsim.payment_webhook.error.v1", ok: false, error: "mock_webhook_secret_unconfigured" },
      leakCtx,
      { status: 503 },
    );
  }

  if (!verifyPaymentWebhookHeaders(provider, req.headers)) {
    return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "unauthorized" }, leakCtx, {
      status: 401,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "invalid_json" }, leakCtx, {
      status: 400,
    });
  }

  const parsed = parseMockWebhookBody(body);
  if (!parsed.ok) {
    return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: parsed.error }, leakCtx, {
      status: 400,
    });
  }

  const res = await processMockPaymentWebhook(parsed.event);
  if (!res.ok) {
    if (res.reason === "unknown_attempt") {
      return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "unknown_attempt" }, leakCtx, {
        status: 404,
      });
    }
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "db_unconfigured" }, leakCtx, {
        status: 503,
      });
    }
    return jsonWithLeakGuard({ schema: "bongsim.payment_webhook.error.v1", ok: false, error: "db_error" }, leakCtx, {
      status: 500,
    });
  }

  const ack = {
    schema: "bongsim.payment_webhook.ack.v1" as const,
    ok: true as const,
    ...(res.duplicate ? { duplicate: true as const } : {}),
  };
  return jsonWithLeakGuard(ack, leakCtx, { status: 200 });
}
