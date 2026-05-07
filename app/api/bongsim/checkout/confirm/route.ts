import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import { checkoutCreateOrderFromRequest } from "@/lib/bongsim/data/checkout-create-order";
import { getPgPool } from "@/lib/bongsim/db/pool";

export async function POST(req: Request) {
  if (!getPgPool()) {
    return jsonWithLeakGuard(
      { schema: "bongsim.checkout_confirm.error.v1", error: "db_unconfigured" },
      "bongsim.checkout.confirm",
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard(
      { schema: "bongsim.checkout_confirm.error.v1", error: "invalid_json" },
      "bongsim.checkout.confirm",
      { status: 400 },
    );
  }

  const res = await checkoutCreateOrderFromRequest(body);
  if (!res.ok) {
    if (res.reason === "validation") {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "validation", details: res.details },
        "bongsim.checkout.confirm",
        { status: 400 },
      );
    }
    if (res.reason === "product_not_found") {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "product_not_found" },
        "bongsim.checkout.confirm",
        { status: 404 },
      );
    }
    if (res.reason === "idempotency_mismatch") {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "idempotency_mismatch" },
        "bongsim.checkout.confirm",
        { status: 409 },
      );
    }
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard(
        { schema: "bongsim.checkout_confirm.error.v1", error: "db_unconfigured" },
        "bongsim.checkout.confirm",
        { status: 503 },
      );
    }
    return jsonWithLeakGuard(
      { schema: "bongsim.checkout_confirm.error.v1", error: "db_error" },
      "bongsim.checkout.confirm",
      { status: 500 },
    );
  }

  const payload: BongsimCheckoutConfirmResponseV1 = {
    schema: "bongsim.checkout_confirm.response.v1",
    order: res.order,
  };
  return jsonWithLeakGuard(payload, "bongsim.checkout.confirm.response", { status: res.reused ? 200 : 201 });
}
