import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import type { BongsimCheckoutConfirmResponseV1 } from "@/lib/bongsim/contracts/checkout-confirm.v1";
import { checkoutCreateOrderFromRequest } from "@/lib/bongsim/data/checkout-create-order";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { auth } from "@/auth";

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

  const session = await auth();
  const uid = ((session?.user as { id?: string } | undefined)?.id ?? "").trim();
  const merged =
    body && typeof body === "object"
      ? { ...(body as Record<string, unknown>), ...(uid ? { bongtour_user_id: uid } : {}) }
      : body;

  const raw = merged && typeof merged === "object" ? (merged as Record<string, unknown>) : {};
  if (Array.isArray(raw.coupon_id) || Array.isArray(raw.user_coupon_id)) {
    return jsonWithLeakGuard(
      { schema: "bongsim.checkout_confirm.error.v1", error: "validation", details: { coupon: "must_be_scalar" } },
      "bongsim.checkout.confirm",
      { status: 400 },
    );
  }
  const pubC = typeof raw.coupon_id === "string" ? raw.coupon_id.trim() : "";
  const usrC = typeof raw.user_coupon_id === "string" ? raw.user_coupon_id.trim() : "";
  if (pubC && usrC) {
    return jsonWithLeakGuard(
      { schema: "bongsim.checkout_confirm.error.v1", error: "validation", details: { coupon: "at_most_one_per_order" } },
      "bongsim.checkout.confirm",
      { status: 400 },
    );
  }

  const res = await checkoutCreateOrderFromRequest(merged);
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
