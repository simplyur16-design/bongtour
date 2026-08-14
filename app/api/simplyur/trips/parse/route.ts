import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { parseTripInboxText } from "@/lib/simplyur/trip-inbox";

export const dynamic = "force-dynamic";

/**
 * POST /api/simplyur/trips/parse
 * Body: { text: string }
 * Stateless parse — Gmail/Outlook sync comes later.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: parse API — manifest
 */
export async function POST(req: Request) {
  const user = await resolveSimplyurApiUser(req);
  if (!user?.email && !user?.userId) {
    return jsonWithLeakGuard({ error: "unauthorized" }, "simplyur.trips.parse", { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonWithLeakGuard({ error: "invalid_json" }, "simplyur.trips.parse", { status: 400 });
  }

  const text =
    body && typeof body === "object" && typeof (body as { text?: unknown }).text === "string"
      ? (body as { text: string }).text
      : "";

  if (!text.trim()) {
    return jsonWithLeakGuard({ error: "empty_text" }, "simplyur.trips.parse", { status: 400 });
  }

  // Cap paste size — email bodies, not PDF binaries
  if (text.length > 200_000) {
    return jsonWithLeakGuard({ error: "text_too_large" }, "simplyur.trips.parse", { status: 413 });
  }

  const result = parseTripInboxText(text);
  return jsonWithLeakGuard(result, "simplyur.trips.parse");
}
