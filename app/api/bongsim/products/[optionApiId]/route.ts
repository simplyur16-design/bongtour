import { NextResponse } from "next/server";
import { getProductDetailByOptionApiId } from "@/lib/bongsim/data/get-product-detail-by-option-api-id";
import { getPgPool } from "@/lib/bongsim/db/pool";

type Ctx = { params: { optionApiId: string } };

export async function GET(_req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
  }
  const { optionApiId } = ctx.params;
  const res = await getProductDetailByOptionApiId(optionApiId);
  if (!res.ok) {
    if (res.reason === "not_found") {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    if (res.reason === "db_unconfigured") {
      return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
    }
    return NextResponse.json({ error: "db_error" }, { status: 503 });
  }
  return NextResponse.json(res.detail);
}
