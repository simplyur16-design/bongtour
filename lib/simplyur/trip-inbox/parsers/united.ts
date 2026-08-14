import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { extractIata, newTempId, parseUnitedDateTime } from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripFlightSegmentPayload, TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

const FLIGHT_HEADER =
  /Flight\s+(\d+)\s+of\s+(\d+)\s+([A-Z0-9]{2}\d{1,4})\s+Class:\s*([^\n]+)/gi;
const UNITED_DATE = /([A-Za-z]{3},\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/g;
const UNITED_TIME = /(\d{1,2}:\d{2}\s*[AP]M)/gi;

/**
 * United Airlines e-ticket / receipt email body.
 * Block-based — do not use `[^\n]+\\s+[^\n]+` across place lines (`\\s` matches newlines).
 */
export function parseUnitedText(text: string): TripParsedSegment[] {
  const confMatch = text.match(/Confirmation Number:\s*\n?\s*([A-Z0-9]{5,6})/i);
  const bookingRef = confMatch?.[1]?.trim() ?? null;

  const travelerMatch = text.match(/Traveler Details\s*\n\s*([A-Z/]+)/i);
  const travelers = travelerMatch?.[1] ? [travelerMatch[1].trim()] : [];

  const ticketMatch = text.match(/eTicket number:\s*([\d\s]+)/i);
  const ticketNumber = ticketMatch?.[1]?.replace(/\s+/g, "").trim() || null;

  const headers = [...text.matchAll(FLIGHT_HEADER)];
  const out: TripParsedSegment[] = [];

  for (let i = 0; i < headers.length; i++) {
    const m = headers[i]!;
    const start = (m.index ?? 0) + m[0].length;
    const end = headers[i + 1]?.index ?? text.length;
    const block = text.slice(start, end);

    const dates = [...block.matchAll(UNITED_DATE)].map((d) => d[1].trim());
    const times = [...block.matchAll(UNITED_TIME)].map((t) => t[1].trim());
    const iatas = [...block.matchAll(/\(([A-Z]{3})\)/g)].map((a) => a[1]);

    const depDate = dates[0] ?? "";
    const arrDate = dates[1] ?? dates[0] ?? "";
    const depTime = times[0] ?? "";
    const arrTime = times[1] ?? "";
    const depAirport = iatas[0] ?? null;
    const arrAirport = iatas[1] ?? null;

    const placeLine =
      block
        .split("\n")
        .map((l) => l.trim())
        .find((l) => /\([A-Z]{3}\)/.test(l) && /,\s*/.test(l)) ?? "";
    let depPlace = placeLine;
    let arrPlace = "";
    if (depAirport && arrAirport && placeLine.includes(`(${depAirport})`)) {
      const splitAt = placeLine.indexOf(`(${depAirport})`) + `(${depAirport})`.length;
      depPlace = placeLine.slice(0, splitAt).trim();
      arrPlace = placeLine.slice(splitAt).trim();
    }

    const flightNo = m[3].toUpperCase();
    const cabin = m[4].trim();
    const depAt = parseUnitedDateTime(depDate, depTime);
    const arrAt = parseUnitedDateTime(arrDate, arrTime);
    const payload: TripFlightSegmentPayload = {
      type: "flight",
      flight_no: flightNo,
      airline: "United Airlines",
      operated_by: /Flight Operated by/i.test(block) ? "see_source" : null,
      dep_airport: depAirport ?? extractIata(depPlace),
      arr_airport: arrAirport ?? extractIata(arrPlace),
      dep_city: depPlace.replace(/\s*\([A-Z]{3}\)\s*$/, "").trim() || null,
      arr_city: arrPlace.replace(/\s*\([A-Z]{3}\)\s*$/, "").trim() || null,
      dep_terminal: null,
      arr_terminal: null,
      dep_at: depAt,
      arr_at: arrAt,
      cabin_class: cabin || null,
      status: null,
      duration: null,
      aircraft: null,
      baggage: null,
      pnr: bookingRef,
      ticket_number: ticketNumber,
      booking_ref: bookingRef,
      travelers,
    };
    out.push(
      finalizeParsedSegment({
        temp_id: newTempId("ua"),
        type: "flight",
        provider: "united",
        sort_at: depAt,
        merge_key: buildMergeKey(payload),
        payload,
      }),
    );
  }
  return out;
}
