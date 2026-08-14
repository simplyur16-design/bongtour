import { jsonWithLeakGuard } from "@/lib/public-response-guard";

export const dynamic = "force-dynamic";

/**
 * Gmail / Outlook OAuth — not wired yet (parse-paste MVP first).
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: inbox oauth stub — manifest
 */
export async function GET() {
  return jsonWithLeakGuard(
    {
      error: "not_implemented",
      message: "Email inbox linking (Gmail/Outlook) is not available yet. Paste confirmation text for now.",
      providers: ["gmail", "outlook"],
    },
    "simplyur.trips.inbox.oauth",
    { status: 501 },
  );
}
