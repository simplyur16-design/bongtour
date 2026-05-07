import { NextResponse } from "next/server";
import { assertNoInternalMetaLeak } from "@/lib/public-response-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { ok: true as const, service: "usimsa-webhook" },
    { status: 200 }
  );
}
