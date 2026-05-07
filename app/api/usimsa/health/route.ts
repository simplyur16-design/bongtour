import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return jsonWithLeakGuard({ ok: true as const, service: "usimsa-webhook" }, "usimsa.health.ping", { status: 200 });
}
