import { NextResponse } from "next/server";
import { createPaymentSessionFromRequest } from "@/lib/bongsim/data/create-payment-session";
import { getPgPool } from "@/lib/bongsim/db/pool";

export async function POST(req: Request) {
  if (!getPgPool()) {
    return NextResponse.json({ schema: "bongsim.payment_session.error.v1", error: "db_unconfigured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { schema: "bongsim.payment_session.error.v1", error: "invalid_json" },
      { status: 400 },
    );
  }

  const res = await createPaymentSessionFromRequest(body);
  if (!res.ok) {
    if (res.reason === "validation") {
      return NextResponse.json(
        { schema: "bongsim.payment_session.error.v1", error: "validation", details: res.details },
        { status: 400 },
      );
    }
    if (res.reason === "order_not_found") {
      return NextResponse.json({ schema: "bongsim.payment_session.error.v1", error: "order_not_found" }, { status: 404 });
    }
    if (res.reason === "order_not_payable") {
      return NextResponse.json(
        { schema: "bongsim.payment_session.error.v1", error: "order_not_payable", details: res.details },
        { status: 400 },
      );
    }
    if (res.reason === "payment_already_captured") {
      return NextResponse.json({ schema: "bongsim.payment_session.error.v1", error: "payment_already_captured" }, { status: 400 });
    }
    if (res.reason === "provider_not_supported") {
      return NextResponse.json(
        { schema: "bongsim.payment_session.error.v1", error: "provider_not_supported", details: res.details },
        { status: 400 },
      );
    }
    if (res.reason === "idempotency_incompatible") {
      return NextResponse.json(
        { schema: "bongsim.payment_session.error.v1", error: "idempotency_incompatible", details: res.details },
        { status: 409 },
      );
    }
    if (res.reason === "db_unconfigured") {
      return NextResponse.json({ schema: "bongsim.payment_session.error.v1", error: "db_unconfigured" }, { status: 503 });
    }
    const errPayload: Record<string, unknown> = { schema: "bongsim.payment_session.error.v1", error: "db_error" };
    if ("details" in res && res.details) errPayload.details = res.details;
    return NextResponse.json(errPayload, { status: 500 });
  }

  return NextResponse.json(res.body, { status: res.body.reused ? 200 : 201 });
}
