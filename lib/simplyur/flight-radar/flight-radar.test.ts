import { afterEach, describe, expect, it } from "vitest";
import { fetchFr24LivePositionsByFlight, normalizeFlightQuery } from "@/lib/simplyur/flight-radar/client";
import { resolveFr24Env } from "@/lib/simplyur/flight-radar/env";
import { buildFlightLiveAlert, canDispatchFlightLivePush } from "@/lib/simplyur/flight-radar/notify";

// REGRESSION-FREEZE[simplyur-flightradar24-live]: disabled without token — manifest

describe("simplyur FlightRadar24 scaffold", () => {
  const prevToken = process.env.FR24_API_TOKEN;
  const prevPush = process.env.SIMPLYUR_FLIGHT_LIVE_PUSH;

  afterEach(() => {
    if (prevToken === undefined) delete process.env.FR24_API_TOKEN;
    else process.env.FR24_API_TOKEN = prevToken;
    if (prevPush === undefined) delete process.env.SIMPLYUR_FLIGHT_LIVE_PUSH;
    else process.env.SIMPLYUR_FLIGHT_LIVE_PUSH = prevPush;
  });

  it("does not call the network when FR24_API_TOKEN is missing", async () => {
    delete process.env.FR24_API_TOKEN;
    expect(resolveFr24Env().ok).toBe(false);
    let called = false;
    const result = await fetchFr24LivePositionsByFlight("KE123", async () => {
      called = true;
      throw new Error("should_not_fetch");
    });
    expect(called).toBe(false);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(canDispatchFlightLivePush().ok).toBe(false);
  });

  it("normalizes flight numbers and builds a delay alert", () => {
    expect(normalizeFlightQuery("ke 123")).toBe("KE123");
    expect(normalizeFlightQuery("???")).toBeNull();
    const alert = buildFlightLiveAlert(
      { flight: "KE123", eta: "2026-11-02T10:00:00Z" },
      {
        flight: "KE123",
        callsign: "KAL123",
        lat: 1,
        lon: 2,
        alt: null,
        speed: null,
        status: null,
        orig_iata: "ICN",
        dest_iata: "NRT",
        eta: "2026-11-02T10:40:00Z",
      },
    );
    expect(alert?.kind).toBe("delay");
  });
});
