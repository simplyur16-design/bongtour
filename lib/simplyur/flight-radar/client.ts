/**
 * FlightRadar24 live client — no-ops until FR24_API_TOKEN is set.
 * REGRESSION-FREEZE[simplyur-flightradar24-live]: no live call without token — manifest
 */
import { resolveFr24Env } from "@/lib/simplyur/flight-radar/env";

export type Fr24LivePosition = {
  flight: string | null;
  callsign: string | null;
  lat: number | null;
  lon: number | null;
  alt: number | null;
  speed: number | null;
  status: string | null;
  orig_iata: string | null;
  dest_iata: string | null;
  eta: string | null;
};

export type Fr24LiveResult =
  | { ok: true; positions: Fr24LivePosition[] }
  | { ok: false; reason: "not_configured" | "http_error"; status?: number; detail?: string };

function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function asStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s || null;
}

function mapPosition(raw: Record<string, unknown>): Fr24LivePosition {
  return {
    flight: asStr(raw.flight) ?? asStr(raw.flight_number),
    callsign: asStr(raw.callsign),
    lat: asNum(raw.lat),
    lon: asNum(raw.lon),
    alt: asNum(raw.alt),
    speed: asNum(raw.gspeed) ?? asNum(raw.speed),
    status: asStr(raw.status) ?? asStr(raw.flight_ended),
    orig_iata: asStr(raw.orig_iata) ?? asStr(raw.origin),
    dest_iata: asStr(raw.dest_iata) ?? asStr(raw.destination),
    eta: asStr(raw.eta) ?? asStr(raw.arr_time_utc),
  };
}

export function normalizeFlightQuery(raw: string): string | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z0-9]{2,8}$/.test(s)) return null;
  return s;
}

/** GET /api/live/flight-positions/full?flights=KE123 */
export async function fetchFr24LivePositionsByFlight(
  flight: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Fr24LiveResult> {
  const env = resolveFr24Env();
  if (!env.ok) return { ok: false, reason: "not_configured" };
  const code = normalizeFlightQuery(flight);
  if (!code) return { ok: true, positions: [] };

  const url = `${env.origin}/api/live/flight-positions/full?flights=${encodeURIComponent(code)}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${env.token}`,
        Accept: "application/json",
        "Accept-Version": env.version,
      },
    });
  } catch (e) {
    return {
      ok: false,
      reason: "http_error",
      detail: e instanceof Error ? e.message.slice(0, 200) : "fetch_failed",
    };
  }

  if (!res.ok) {
    return { ok: false, reason: "http_error", status: res.status };
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, reason: "http_error", detail: "invalid_json" };
  }

  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object" && Array.isArray((json as { data?: unknown }).data)
      ? ((json as { data: unknown[] }).data ?? [])
      : [];
  const positions = rows
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map(mapPosition);
  return { ok: true, positions };
}
