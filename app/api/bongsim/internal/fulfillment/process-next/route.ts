import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { processNextOrderPaidOutbox } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isInternalRequestAuthorized, resolveInternalRouteSecret } from "@/lib/bongsim/runtime/internal-route-guard";

export async function POST(req: Request) {
  const sec = resolveInternalRouteSecret(process.env.BONGSIM_INTERNAL_FULFILLMENT_SECRET);
  if (!sec.ok) {
    return jsonWithLeakGuard({ error: "fulfillment_secret_unconfigured" }, "bongsim.internal.fulfillment.process-next", {
      status: 503,
    });
  }
  if (!isInternalRequestAuthorized(req.headers.get("x-bongsim-internal-secret"), sec.secret)) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "bongsim.internal.fulfillment.process-next", { status: 401 });
  }
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.internal.fulfillment.process-next", { status: 503 });
  }

  const result = await processNextOrderPaidOutbox();
  return jsonWithLeakGuard(result, "bongsim.internal.fulfillment.process-next");
}
