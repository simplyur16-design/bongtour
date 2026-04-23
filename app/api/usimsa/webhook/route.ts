import { NextResponse } from "next/server";
import {
  extractClientIp,
  getAllowedUsimsaWebhookIps,
  isAllowedUsimsaIp,
} from "@/lib/bongsim/supplier/usimsa/allowed-ips";
import { handleUsimsaWebhook } from "@/lib/bongsim/supplier/usimsa/webhook-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const clientIp = extractClientIp(req.headers);
  const allowed = getAllowedUsimsaWebhookIps();

  if (!isAllowedUsimsaIp(clientIp, allowed)) {
    console.warn("[usimsa:webhook] ip blocked", { clientIp, allowed });
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("[usimsa:webhook] invalid json", { clientIp });
    return NextResponse.json({ ok: true, note: "invalid_json_swallowed" }, { status: 200 });
  }

  try {
    const result = await handleUsimsaWebhook(body);
    console.info("[usimsa:webhook]", { clientIp, outcome: result.outcome });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    console.error("[usimsa:webhook] handler threw", {
      clientIp,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ ok: true, note: "error_swallowed" }, { status: 200 });
  }
}
