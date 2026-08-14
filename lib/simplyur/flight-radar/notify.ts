/**
 * Flight live → Expo push payload (wired later when FR24_API_TOKEN is set).
 * REGRESSION-FREEZE[simplyur-flightradar24-live]: push plan only, no send without token — manifest
 */
import type { Fr24LivePosition } from "@/lib/simplyur/flight-radar/client";
import { isSimplyurFlightLivePushEnabled, resolveFr24Env } from "@/lib/simplyur/flight-radar/env";

export type FlightAlertKind = "delay" | "gate_or_status" | "eta";

export type FlightAlert = {
  kind: FlightAlertKind;
  flight: string;
  title: string;
  body: string;
};

export type ScheduledFlightHint = {
  flight: string;
  eta?: string | null;
  status?: string | null;
};

const DELAY_MS = 15 * 60 * 1000;

function parseInstant(raw: string | null | undefined): number | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : null;
}

export function buildFlightLiveAlert(
  scheduled: ScheduledFlightHint,
  live: Fr24LivePosition,
): FlightAlert | null {
  const flight = (live.flight || scheduled.flight).trim().toUpperCase();
  if (!flight) return null;

  const liveStatus = (live.status ?? "").toLowerCase();
  if (/(cancel|divert|emergency)/.test(liveStatus)) {
    return {
      kind: "gate_or_status",
      flight,
      title: `${flight} status update`,
      body: `Your flight ${flight} is now ${live.status}.`,
    };
  }

  const schedEta = parseInstant(scheduled.eta);
  const liveEta = parseInstant(live.eta);
  if (schedEta != null && liveEta != null && liveEta - schedEta >= DELAY_MS) {
    const mins = Math.round((liveEta - schedEta) / 60000);
    return {
      kind: "delay",
      flight,
      title: `${flight} delay`,
      body: `${flight} looks about ${mins} minutes later than planned.`,
    };
  }

  if (live.eta && scheduled.eta && live.eta !== scheduled.eta) {
    return {
      kind: "eta",
      flight,
      title: `${flight} ETA update`,
      body: `${flight} updated arrival: ${live.eta}.`,
    };
  }

  return null;
}

/** Later: look up SimplyurDevicePushToken and POST Expo. No-op until token + flag. */
export function canDispatchFlightLivePush(): { ok: true } | { ok: false; reason: string } {
  const env = resolveFr24Env();
  if (!env.ok) return { ok: false, reason: "fr24_not_configured" };
  if (!isSimplyurFlightLivePushEnabled()) return { ok: false, reason: "push_flag_off" };
  return { ok: true };
}
