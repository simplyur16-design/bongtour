import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { newTempId, parseCompactAirlineDateTime } from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripFlightSegmentPayload, TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

/**
 * Bong Tour / agency e-ticket itinerary (KE/OZ style).
 * Handles both duplicated-line OCR and cleaner Passenger Itinerary layout.
 */
export function parseBongtourEticketText(text: string): TripParsedSegment[] {
  const pnr =
    text.match(/예약번호:\s*\n?\s*([A-Z0-9]{5,6})/)?.[1] ||
    text.match(/Booking Reference\s*([A-Z0-9]{5,6})/i)?.[1] ||
    text.match(/예약\s*번호\s+Booking Reference\s*([A-Z0-9]+)/i)?.[1] ||
    null;

  const ticket =
    text.match(/항공권\s*번호\s+Ticket Number\s*(\d+)/i)?.[1] ||
    text.match(/Ticket Number\s*(\d+)/i)?.[1] ||
    null;

  const travelers: string[] = [];
  const paxLine = text.match(/Passenger Name\s*([^\n]+)/i)?.[1];
  if (paxLine) {
    for (const part of paxLine.split(/,/)) {
      const n = part.trim();
      if (n) travelers.push(n);
    }
  }
  const single = text.match(/\n([A-Z]+\/[A-Z]+)\n/);
  if (single && travelers.length === 0) travelers.push(single[1]);

  const out: TripParsedSegment[] = [];

  // Compact itinerary rows: "OZ 701" / "KE0765" with surrounding airports
  const flightNos = [...text.matchAll(/\b([A-Z]{2})\s?(\d{3,4})\b/g)];
  const seen = new Set<string>();

  for (const fm of flightNos) {
    const flightNo = `${fm[1]}${fm[2]}`.toUpperCase();
    if (seen.has(flightNo)) continue;
    // skip fare basis noise
    if (/^(BP|OI|SW|TK|YR|YQ)$/i.test(fm[1])) continue;
    seen.add(flightNo);

    const idx = fm.index ?? 0;
    const window = text.slice(Math.max(0, idx - 220), idx + 280);

    const iata = [...window.matchAll(/\b([A-Z]{3})\b/g)].map((x) => x[1]);
    // Prefer known airport codes near flight
    const airports = iata.filter((c) =>
      ["ICN", "GMP", "NRT", "HND", "CTS", "MNL", "BOS", "ORD", "STL", "EWR"].includes(c),
    );
    const depAirport = airports[0] ?? null;
    const arrAirport = airports[1] ?? airports.find((a) => a !== depAirport) ?? null;

    const times = [...window.matchAll(/(\d{2}[A-Z]{3}\d{2,4}(?:\([^)]*\))?\s*\d{1,2}:\d{2})/gi)];
    let depAt: string | null = null;
    let arrAt: string | null = null;
    if (times[0]) depAt = parseCompactAirlineDateTime(times[0][1]);
    if (times[1]) arrAt = parseCompactAirlineDateTime(times[1][1]);

    // Cleaner layout: "29JUL2026(수) 07:35"
    if (!depAt) {
      const t2 = [...window.matchAll(/(\d{2}[A-Z]{3}\d{4}\([^)]*\)\s*\d{2}:\d{2})/gi)];
      if (t2[0]) depAt = parseCompactAirlineDateTime(t2[0][1]);
      if (t2[1]) arrAt = parseCompactAirlineDateTime(t2[1][1]);
    }

    const airline =
      window.match(/KOREAN AIR/i)?.[0] ||
      window.match(/ASIANA AIRLINES/i)?.[0] ||
      (flightNo.startsWith("KE") ? "KOREAN AIR" : flightNo.startsWith("OZ") ? "ASIANA AIRLINES" : null);

    const cabin =
      window.match(/([A-Z])\s*\(일반석\)/)?.[0] ||
      window.match(/ECONOMY(?:\/[A-Z])?/i)?.[0] ||
      null;

    const payload: TripFlightSegmentPayload = {
      type: "flight",
      flight_no: flightNo,
      airline,
      operated_by: airline,
      dep_airport: depAirport,
      arr_airport: arrAirport,
      dep_city: null,
      arr_city: null,
      dep_terminal: window.match(/Terminal No:\s*\n?\s*([A-Z0-9]+)/i)?.[1] ?? null,
      arr_terminal: null,
      dep_at: depAt,
      arr_at: arrAt,
      cabin_class: cabin,
      status: /OK\s*\(?확약\)?/i.test(window) ? "OK" : null,
      duration: window.match(/(\d+시간\s*\d+분)/)?.[1] ?? null,
      aircraft: window.match(/(BOEING[^ \n]+|AIRBUS[^ \n]+)/i)?.[1] ?? null,
      baggage: window.match(/(\d+PC)/i)?.[1] ?? null,
      pnr,
      ticket_number: ticket,
      booking_ref: pnr,
      travelers,
    };

    out.push(
      finalizeParsedSegment({
        temp_id: newTempId("bt"),
        type: "flight",
        provider: "bongtour_eticket",
        sort_at: depAt,
        merge_key: buildMergeKey(payload),
        payload,
      }),
    );
  }

  return out;
}
