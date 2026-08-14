import { jsonWithLeakGuard } from "@/lib/public-response-guard";
import { resolveSimplyurApiUser } from "@/lib/simplyur/auth/resolve-simplyur-api-user";
import { fetchFr24LivePositionsByFlight } from "@/lib/simplyur/flight-radar/client";

export const dynamic = "force-dynamic";

/**
 * GET /api/simplyur/flights/live?flight=KE123
 * Scaffold: 503 until FR24_API_TOKEN is set. Does not sign up or store the token in git.
 * REGRESSION-FREEZE[simplyur-flightradar24-live]: live route token gate — manifest
 */
export async function GET(req: Request) {
  const user = await resolveSimplyurApiUser(req);
  if (!user?.userId) {
    return jsonWithLeakGuard({ error: "login_required" }, "simplyur.flights.live", { status: 401 });
  }

  const flight = new URL(req.url).searchParams.get("flight") ?? "";
  const result = await fetchFr24LivePositionsByFlight(flight);
  if (!result.ok && result.reason === "not_configured") {
    return jsonWithLeakGuard(
      {
        error: "fr24_not_configured",
        message: "Live flight tracking is prepared but not enabled yet. Set FR24_API_TOKEN later.",
      },
      "simplyur.flights.live",
      { status: 503 },
    );
  }
  if (!result.ok) {
    return jsonWithLeakGuard({ error: "fr24_unavailable" }, "simplyur.flights.live", { status: 502 });
  }
  return jsonWithLeakGuard({ positions: result.positions }, "simplyur.flights.live");
}
