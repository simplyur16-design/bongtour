import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getOrderPublic } from "@/lib/bongsim/data/get-order-public";
import { getPgPool } from "@/lib/bongsim/db/pool";

type Ctx = { params: Promise<{ orderId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.orders.detail.public", { status: 503 });
  }
  const { orderId } = await ctx.params;
  const u = new URL(req.url);
  const readKey = u.searchParams.get("read_key");
  const res = await getOrderPublic(orderId, { readKey });
  if (!res.ok) {
    if (res.reason === "not_found") return jsonWithLeakGuard({ error: "not_found" }, "bongsim.orders.detail.public", { status: 404 });
    if (res.reason === "read_key_required" || res.reason === "read_key_invalid") {
      return jsonWithLeakGuard({ error: "not_found" }, "bongsim.orders.detail.public", { status: 404 });
    }
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.orders.detail.public", { status: 503 });
    }
    return jsonWithLeakGuard({ error: "db_error" }, "bongsim.orders.detail.public", { status: 500 });
  }
  return jsonWithLeakGuard(res.order, "bongsim.orders.detail.public");
}
