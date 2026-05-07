import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { getProductDetailByOptionApiId } from "@/lib/bongsim/data/get-product-detail-by-option-api-id";
import { getPgPool } from "@/lib/bongsim/db/pool";

type Ctx = { params: Promise<{ optionApiId: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.products.detail", { status: 503 });
  }
  const { optionApiId } = await ctx.params;
  const res = await getProductDetailByOptionApiId(optionApiId);
  if (!res.ok) {
    if (res.reason === "not_found") {
      return jsonWithLeakGuard({ error: "not_found" }, "bongsim.products.detail", { status: 404 });
    }
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.products.detail", { status: 503 });
    }
    return jsonWithLeakGuard({ error: "db_error" }, "bongsim.products.detail", { status: 503 });
  }
  return jsonWithLeakGuard(res.detail, "bongsim.products.detail");
}
