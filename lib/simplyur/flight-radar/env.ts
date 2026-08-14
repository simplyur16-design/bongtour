/**
 * FlightRadar24 API — token later; never call live endpoints without it.
 * REGRESSION-FREEZE[simplyur-flightradar24-live]: env gate — manifest
 * @see https://fr24api.flightradar24.com/docs/endpoints/overview
 */

export const FR24_API_ORIGIN = "https://fr24api.flightradar24.com";
export const FR24_API_VERSION = "v1";

export type Fr24Env =
  | { ok: true; token: string; origin: string; version: string }
  | { ok: false; reason: "not_configured" };

export function resolveFr24Env(): Fr24Env {
  const token = (process.env.FR24_API_TOKEN ?? "").trim();
  if (!token) return { ok: false, reason: "not_configured" };
  return { ok: true, token, origin: FR24_API_ORIGIN, version: FR24_API_VERSION };
}

export function isSimplyurFlightLivePushEnabled(): boolean {
  const raw = (process.env.SIMPLYUR_FLIGHT_LIVE_PUSH ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
