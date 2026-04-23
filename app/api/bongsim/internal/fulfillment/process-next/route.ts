import { NextResponse } from "next/server";
import { processNextOrderPaidOutbox } from "@/lib/bongsim/fulfillment/process-order-paid-outbox";
import { getPgPool } from "@/lib/bongsim/db/pool";
import { isInternalRequestAuthorized, resolveInternalRouteSecret } from "@/lib/bongsim/runtime/internal-route-guard";

export async function POST(req: Request) {
  const sec = resolveInternalRouteSecret(process.env.BONGSIM_INTERNAL_FULFILLMENT_SECRET);
  if (!sec.ok) {
    return NextResponse.json({ error: "fulfillment_secret_unconfigured" }, { status: 503 });
  }
  if (!isInternalRequestAuthorized(req.headers.get("x-bongsim-internal-secret"), sec.secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!getPgPool()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }

  const result = await processNextOrderPaidOutbox();
  return NextResponse.json(result);
}
