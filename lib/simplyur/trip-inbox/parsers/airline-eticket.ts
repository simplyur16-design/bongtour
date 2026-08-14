/**
 * Generic IATA airline e-ticket / passenger itinerary (any carrier).
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: parseAirlineEticketText — manifest
 */
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import {
  extractIata,
  newTempId,
  parseCompactAirlineDateTime,
  parseEnDateOptionalTime,
  parseKoDateTime,
  parseUnitedDateTime,
  toIsoLocal,
} from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripFlightSegmentPayload, TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

const KNOWN_AIRLINE_PREFIX = new Set([
  "KE", "OZ", "UA", "AA", "DL", "BA", "LH", "AF", "KL", "SQ", "CX", "QF", "NH", "JL",
  "EK", "QR", "TK", "EY", "AC", "WN", "B6", "AS", "HA", "VS", "AI", "PR", "VN", "TG",
  "MH", "CI", "BR", "TW", "LJ", "ZE", "RS", "MM", "GK", "IT", "BX", "7C", "LJ", "ZE",
  "MU", "CA", "CZ", "HU", "MF", "HO", "NZ", "FJ", "GA", "ID", "AK", "D7", "TR", "JX",
  "ZG", "YP", "RF", "KE", "OZ", "KE", "HA", "F9", "NK", "SY", "WS", "PD", "AM", "AV",
  "LA", "JJ", "CM", "IB", "VY", "AZ", "LX", "OS", "SK", "AY", "LO", "OK", "TP", "EI",
  "FI", "DY", "U2", "FR", "W6", "PC", "MS", "SV", "WY", "UL", "ET", "KQ", "SA", "AT",
]);

const SKIP_PREFIX = new Set(["TO", "OF", "BY", "IN", "ON", "AT", "AM", "PM", "NO", "OR", "THE"]);

function bookingBits(text: string): { pnr: string | null; ticket: string | null; travelers: string[] } {
  const pnr =
    text.match(/Booking Reference\s*[:\s]*([A-Z0-9]{5,8})/i)?.[1] ||
    text.match(/Confirmation(?:\s+Number)?\s*[:\s]*([A-Z0-9]{5,8})/i)?.[1] ||
    text.match(/PNR\s*[:\s]*([A-Z0-9]{5,8})/i)?.[1] ||
    text.match(/예약\s*번호\s*[:\s]*([A-Z0-9]{5,8})/i)?.[1] ||
    text.match(/항공사\s*예약번호\s*\(PNR\)\s*:\s*([A-Z0-9]+)/i)?.[1] ||
    null;
  const ticket =
    text.match(/e-?Ticket(?:\s+number)?\s*[:\s]*([\d\s]{10,18})/i)?.[1]?.replace(/\s+/g, "") ||
    text.match(/Ticket Number\s*[:\s]*([\d\s]{10,18})/i)?.[1]?.replace(/\s+/g, "") ||
    text.match(/항공권\s*번호\s*[:\s]*([\d\s]{10,18})/i)?.[1]?.replace(/\s+/g, "") ||
    null;
  const travelers: string[] = [];
  const pax =
    text.match(/Passenger(?:\s+Name)?\s*[:\s]*([A-Z][A-Z/\s]+)/i)?.[1] ||
    text.match(/승객\s*성명\s*[:\s]*([A-Z][A-Z/\s,]+)/i)?.[1];
  if (pax) {
    for (const part of pax.split(/,/)) {
      const n = part.trim();
      if (n.length >= 3) travelers.push(n);
    }
  }
  return { pnr, ticket, travelers };
}

function parseTimesNear(window: string): { depAt: string | null; arrAt: string | null } {
  const compact = [...window.matchAll(/(\d{2}[A-Z]{3}\d{2,4}(?:\([^)]*\))?\s*\d{1,2}:\d{2})/gi)];
  let depAt = compact[0] ? parseCompactAirlineDateTime(compact[0][1]) : null;
  let arrAt = compact[1] ? parseCompactAirlineDateTime(compact[1][1]) : null;
  if (!depAt) {
    const ko = [...window.matchAll(/(\d{4}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일\s*\d{1,2}:\d{2})/g)];
    if (ko[0]) depAt = parseKoDateTime(ko[0][1]);
    if (ko[1]) arrAt = parseKoDateTime(ko[1][1]);
  }
  if (!depAt) {
    const usDate = [...window.matchAll(/([A-Za-z]{3},\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/g)].map((d) => d[1]);
    const usTime = [...window.matchAll(/(\d{1,2}:\d{2}\s*[AP]M)/gi)].map((d) => d[1]);
    if (usDate[0] && usTime[0]) depAt = parseUnitedDateTime(usDate[0], usTime[0]);
    if (usDate[1] && usTime[1]) arrAt = parseUnitedDateTime(usDate[1], usTime[1]);
    else if (usDate[0] && usTime[1]) arrAt = parseUnitedDateTime(usDate[0], usTime[1]);
  }
  if (!depAt) {
    const en = parseEnDateOptionalTime(window);
    if (en) depAt = toIsoLocal(en.date, en.time, "00:00");
  }
  return { depAt, arrAt };
}

export function parseAirlineEticketText(text: string): TripParsedSegment[] {
  const { pnr, ticket, travelers } = bookingBits(text);
  const flightRe = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s*-?\s*(\d{2,4})\b/g;
  const seen = new Set<string>();
  const out: TripParsedSegment[] = [];

  for (const fm of text.matchAll(flightRe)) {
    const prefix = fm[1].toUpperCase();
    if (SKIP_PREFIX.has(prefix)) continue;
    if (!KNOWN_AIRLINE_PREFIX.has(prefix) && !/e-?ticket|편명|flight/i.test(text)) continue;
    const flightNo = `${prefix}${fm[2]}`.toUpperCase();
    if (seen.has(flightNo)) continue;
    seen.add(flightNo);

    const idx = fm.index ?? 0;
    const window = text.slice(Math.max(0, idx - 240), idx + 320);
    const paren = [...window.matchAll(/\(([A-Z]{3})\)/g)].map((x) => x[1]);
    const bare = [...window.matchAll(/\b([A-Z]{3})\b/g)].map((x) => x[1]);
    const iatas = (paren.length >= 2 ? paren : [...paren, ...bare]).filter(
      (c) => !/^(THE|AND|FOR|CLASS|FROM|TO|SEAT|GATE|PNR|OK|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)$/.test(c),
    );
    const depAirport = iatas[0] ? extractIata(iatas[0]) ?? iatas[0] : null;
    const arrAirport = iatas.find((a) => a !== depAirport) ?? null;
    const { depAt, arrAt } = parseTimesNear(window);

    const airline =
      window.match(/KOREAN AIR/i)?.[0] ||
      window.match(/ASIANA AIRLINES/i)?.[0] ||
      window.match(/UNITED AIRLINES/i)?.[0] ||
      window.match(/JAPAN AIRLINES|JAL/i)?.[0] ||
      window.match(/ALL NIPPON|ANA/i)?.[0] ||
      window.match(/SINGAPORE AIRLINES/i)?.[0] ||
      window.match(/CATHAY PACIFIC/i)?.[0] ||
      window.match(/DELTA AIR LINES/i)?.[0] ||
      window.match(/AMERICAN AIRLINES/i)?.[0] ||
      window.match(/BRITISH AIRWAYS/i)?.[0] ||
      window.match(/LUFTHANSA/i)?.[0] ||
      window.match(/EMIRATES/i)?.[0] ||
      window.match(/QATAR AIRWAYS/i)?.[0] ||
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
      dep_terminal: window.match(/Terminal(?:\s*No)?[:\s]*([A-Z0-9]+)/i)?.[1] ?? null,
      arr_terminal: null,
      dep_at: depAt,
      arr_at: arrAt,
      cabin_class: window.match(/Economy|Business|First|Premium|일반석|비즈니스/i)?.[0] ?? null,
      status: /OK\s*\(?확약\)?/i.test(window) ? "OK" : null,
      duration: null,
      aircraft: null,
      baggage: window.match(/(\d+\s*PC)/i)?.[1] ?? null,
      pnr,
      ticket_number: ticket,
      booking_ref: pnr,
      travelers,
    };
    out.push(
      finalizeParsedSegment({
        temp_id: newTempId("al"),
        type: "flight",
        provider: "airline_eticket",
        sort_at: depAt,
        merge_key: buildMergeKey(payload),
        payload,
      }),
    );
  }

  return out;
}
