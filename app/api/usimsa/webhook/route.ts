import { NextResponse } from "next/server";
import { jsonWithLeakGuard } from "@/lib/public-response-guard";
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
    return jsonWithLeakGuard({ ok: false, error: "forbidden" }, "usimsa.webhook.legacy", { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("[usimsa:webhook] invalid json", { clientIp });
    return jsonWithLeakGuard({ ok: true, note: "invalid_json_swallowed" }, "usimsa.webhook.legacy", { status: 200 });
  }

  try {
    const result = await handleUsimsaWebhook(body);
    console.info("[usimsa:webhook]", { clientIp, outcome: result.outcome });
    return jsonWithLeakGuard({ ok: true }, "usimsa.webhook.legacy", { status: 200 });
  } catch (e) {
    console.error("[usimsa:webhook] handler threw", {
      clientIp,
      error: e instanceof Error ? e.message : String(e),
    });
    return jsonWithLeakGuard({ ok: true, note: "error_swallowed" }, "usimsa.webhook.legacy", { status: 200 });
  }
}
