import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { createPaymentSessionFromRequest } from "@/lib/bongsim/data/create-payment-session";
import { getPgPool } from "@/lib/bongsim/db/pool";

export async function POST(req: Request) {
  if (!getPgPool()) {
    return jsonWithLeakGuard(
      { schema: "bongsim.payment_session.error.v1", error: "db_unconfigured" },
      "bongsim.payments.session",
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard(
      { schema: "bongsim.payment_session.error.v1", error: "invalid_json" },
      "bongsim.payments.session",
      { status: 400 },
    );
  }

  const res = await createPaymentSessionFromRequest(body);
  if (!res.ok) {
    if (res.reason === "validation") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "validation", details: res.details },
        "bongsim.payments.session",
        { status: 400 },
      );
    }
    if (res.reason === "order_not_found") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "order_not_found" },
        "bongsim.payments.session",
        { status: 404 },
      );
    }
    if (res.reason === "order_not_payable") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "order_not_payable", details: res.details },
        "bongsim.payments.session",
        { status: 400 },
      );
    }
    if (res.reason === "payment_already_captured") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "payment_already_captured" },
        "bongsim.payments.session",
        { status: 400 },
      );
    }
    if (res.reason === "provider_not_supported") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "provider_not_supported", details: res.details },
        "bongsim.payments.session",
        { status: 400 },
      );
    }
    if (res.reason === "idempotency_incompatible") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "idempotency_incompatible", details: res.details },
        "bongsim.payments.session",
        { status: 409 },
      );
    }
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard(
        { schema: "bongsim.payment_session.error.v1", error: "db_unconfigured" },
        "bongsim.payments.session",
        { status: 503 },
      );
    }
    const errPayload: Record<string, unknown> = { schema: "bongsim.payment_session.error.v1", error: "db_error" };
    if ("details" in res && res.details) errPayload.details = res.details;
    return jsonWithLeakGuard(errPayload, "bongsim.payments.session", { status: 500 });
  }

  return jsonWithLeakGuard(res.body, "bongsim.payments.session.response", { status: res.body.reused ? 200 : 201 });
}
