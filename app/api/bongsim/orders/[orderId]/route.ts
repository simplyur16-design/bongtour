import { NextResponse } from "next/server";
import { getOrderPublic } from "@/lib/bongsim/data/get-order-public";
import { getPgPool } from "@/lib/bongsim/db/pool";

type Ctx = { params: { orderId: string } };

export async function GET(req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const { orderId } = ctx.params;
  const u = new URL(req.url);
  const readKey = u.searchParams.get("read_key");
  const res = await getOrderPublic(orderId, { readKey });
  if (!res.ok) {
    if (res.reason === "not_found") return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (res.reason === "read_key_required" || res.reason === "read_key_invalid") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (res.reason === "db_unconfigured") {
      return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }
  return NextResponse.json(res.order);
}
