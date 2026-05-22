import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getCheckoutRetryContext } from "@/lib/bongsim/data/get-checkout-retry-context";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const orderId = new URL(req.url).searchParams.get("orderId")?.trim() ?? "";
  const r = await getCheckoutRetryContext(orderId);
  if (!r.ok) {
    const status =
      r.reason === "db_unconfigured"
        ? 503
        : r.reason === "invalid_order_id"
          ? 400
          : r.reason === "not_payable"
            ? 409
            : 404;
    return jsonWithLeakGuard({ ok: false, error: r.reason }, "bongsim.checkout.retry-context", { status });
  }
  return jsonWithLeakGuard(
    {
      ok: true,
      schema: "bongsim.checkout_retry_context.v1",
      order_id: r.context.order_id,
      order_number: r.context.order_number,
      option_api_id: r.context.option_api_id,
      quantity: r.context.quantity,
      buyer_email: r.context.buyer_email,
      grand_total_krw: r.context.grand_total_krw,
    },
    "bongsim.checkout.retry-context",
  );
}
