import { NextResponse } from "next/server";

import { UsimsaRequestError } from "@/lib/usimsa/client";
import { fetchUsimsaProducts } from "@/lib/usimsa/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const products = await fetchUsimsaProducts();
    return NextResponse.json({
      ok: true as const,
      count: products.length,
      sample: products.slice(0, 5),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof UsimsaRequestError) {
      console.error("[usimsa:test-products] upstream", {
        method: err.method,
        pathAndQuery: err.pathAndQuery,
        status: err.status,
        responseBody: err.responseBody,
      });
      return NextResponse.json(
        { ok: false as const, error: message },
        { status: 502 },
      );
    }
    console.error("[usimsa:test-products]", message);
    const status = message.includes("Usimsa:") && message.includes("missing") ? 500 : 502;
    return NextResponse.json({ ok: false as const, error: message }, { status });
  }
}
