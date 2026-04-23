import { NextResponse } from "next/server";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import { checkoutCreateOrderFromRequest } from "@/lib/bongsim/data/checkout-create-order";
import { getPgPool } from "@/lib/bongsim/db/pool";

export async function POST(req: Request) {
  if (!getPgPool()) {
    return NextResponse.json({ schema: "bongsim.checkout_confirm.error.v1", error: "db_unconfigured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { schema: "bongsim.checkout_confirm.error.v1", error: "invalid_json" },
      { status: 400 },
    );
  }

  const res = await checkoutCreateOrderFromRequest(body);
  if (!res.ok) {
    if (res.reason === "validation") {
      return NextResponse.json(
        { schema: "bongsim.checkout_confirm.error.v1", error: "validation", details: res.details },
        { status: 400 },
      );
    }
    if (res.reason === "product_not_found") {
      return NextResponse.json({ schema: "bongsim.checkout_confirm.error.v1", error: "product_not_found" }, { status: 404 });
    }
    if (res.reason === "idempotency_mismatch") {
      return NextResponse.json({ schema: "bongsim.checkout_confirm.error.v1", error: "idempotency_mismatch" }, { status: 409 });
    }
    if (res.reason === "db_unconfigured") {
      return NextResponse.json({ schema: "bongsim.checkout_confirm.error.v1", error: "db_unconfigured" }, { status: 503 });
    }
    return NextResponse.json({ schema: "bongsim.checkout_confirm.error.v1", error: "db_error" }, { status: 500 });
  }

  const payload: BongsimCheckoutConfirmResponseV1 = {
    schema: "bongsim.checkout_confirm.response.v1",
    order: res.order,
  };
  return NextResponse.json(payload, { status: res.reused ? 200 : 201 });
}
