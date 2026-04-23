import { NextResponse } from "next/server";
import { listCatalogProducts } from "@/lib/bongsim/data/list-catalog-products";
import { getPgPool } from "@/lib/bongsim/db/pool";

export async function GET(req: Request) {
  if (!getPgPool()) {
    return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
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
      return NextResponse.json({ error: "db_unconfigured" }, { status: 503 });
    }
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ schema: "bongsim.product_catalog.list.v1", items: res.rows });
}
