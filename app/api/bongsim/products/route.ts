import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { listCatalogProducts } from "@/lib/bongsim/data/list-catalog-products";
import { getPgPool } from "@/lib/bongsim/db/pool";

export async function GET(req: Request) {
  if (!getPgPool()) {
    return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.products.list", { status: 503 });
  }

  const u = new URL(req.url);
  const network_family = u.searchParams.get("network_family");
  const plan_type = u.searchParams.get("plan_type");
  const q = u.searchParams.get("q");

  const res = await listCatalogProducts({
    network_family,
    plan_type,
    q,
  });

  if (!res.ok) {
    if (res.reason === "db_unconfigured") {
      return jsonWithLeakGuard({ error: "db_unconfigured" }, "bongsim.products.list", { status: 503 });
    }
    return jsonWithLeakGuard({ error: "db_error" }, "bongsim.products.list", { status: 500 });
  }

  return jsonWithLeakGuard({ schema: "bongsim.product_catalog.list.v1", items: res.rows }, "bongsim.products.list");
}
