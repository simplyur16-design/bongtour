/**
 * Trip Inbox parse entry — detect provider, run parser, merge duplicates.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: parseTripInboxText — manifest
 */
import { detectTripProvider } from "@/lib/simplyur/trip-inbox/detect-provider";
import { parseAgodaText } from "@/lib/simplyur/trip-inbox/parsers/agoda";
import { parseBongtourEticketText } from "@/lib/simplyur/trip-inbox/parsers/bongtour-eticket";
import { parseRakutenTravelText } from "@/lib/simplyur/trip-inbox/parsers/rakuten-travel";
import { parseTripComText } from "@/lib/simplyur/trip-inbox/parsers/trip-com";
import { parseUnitedText } from "@/lib/simplyur/trip-inbox/parsers/united";
import type { TripParsedSegment, TripParseResult, TripProvider } from "@/lib/simplyur/trip-inbox/types";
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { newTempId } from "@/lib/simplyur/trip-inbox/date-parse";

function dedupeByMergeKey(segments: TripParsedSegment[]): TripParsedSegment[] {
  const map = new Map<string, TripParsedSegment>();
  const noKey: TripParsedSegment[] = [];
  for (const s of segments) {
    if (!s.merge_key) {
      noKey.push(s);
      continue;
    }
    const prev = map.get(s.merge_key);
    if (!prev || s.confidence > prev.confidence) map.set(s.merge_key, s);
  }
  return [...map.values(), ...noKey].sort((a, b) => {
    const ta = a.sort_at ? Date.parse(a.sort_at) : Number.POSITIVE_INFINITY;
    const tb = b.sort_at ? Date.parse(b.sort_at) : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}

function runProvider(provider: TripProvider, text: string): TripParsedSegment[] {
  switch (provider) {
    case "united":
      return parseUnitedText(text);
    case "trip_com":
      return parseTripComText(text);
    case "agoda":
      return parseAgodaText(text);
    case "rakuten_travel":
      return parseRakutenTravelText(text);
    case "bongtour_eticket":
      return parseBongtourEticketText(text);
    default:
      return [];
  }
}

export function parseTripInboxText(raw: string): TripParseResult {
  const text = raw.replace(/\u00a0/g, " ").trim();
  const warnings: string[] = [];
  if (!text) {
    return {
      provider: "unknown",
      segments: [
        finalizeParsedSegment({
          temp_id: newTempId("empty"),
          type: "flight",
          provider: "unknown",
          sort_at: null,
          merge_key: null,
          payload: {
            type: "flight",
            flight_no: null,
            airline: null,
            operated_by: null,
            dep_airport: null,
            arr_airport: null,
            dep_city: null,
            arr_city: null,
            dep_terminal: null,
            arr_terminal: null,
            dep_at: null,
            arr_at: null,
            cabin_class: null,
            status: null,
            duration: null,
            aircraft: null,
            baggage: null,
            pnr: null,
            ticket_number: null,
            booking_ref: null,
            travelers: [],
          },
          confidence: 0,
        }),
      ],
      warnings: ["empty_text"],
    };
  }

  const provider = detectTripProvider(text);
  let segments = runProvider(provider, text);

  // Fallback: try other parsers if primary yielded nothing
  if (segments.length === 0 && provider !== "unknown") {
    warnings.push(`primary_empty:${provider}`);
  }
  if (segments.length === 0) {
    for (const p of ["united", "trip_com", "agoda", "rakuten_travel", "bongtour_eticket"] as const) {
      if (p === provider) continue;
      const tried = runProvider(p, text);
      if (tried.length) {
        segments = tried;
        warnings.push(`fallback_provider:${p}`);
        break;
      }
    }
  }

  if (segments.length === 0) {
    warnings.push("no_segments");
    segments = [
      finalizeParsedSegment({
        temp_id: newTempId("fail"),
        type: "flight",
        provider,
        sort_at: null,
        merge_key: null,
        payload: {
          type: "flight",
          flight_no: null,
          airline: null,
          operated_by: null,
          dep_airport: null,
          arr_airport: null,
          dep_city: null,
          arr_city: null,
          dep_terminal: null,
          arr_terminal: null,
          dep_at: null,
          arr_at: null,
          cabin_class: null,
          status: null,
          duration: null,
          aircraft: null,
          baggage: null,
          pnr: null,
          ticket_number: null,
          booking_ref: null,
          travelers: [],
        },
        confidence: 0.1,
      }),
    ];
  }

  return {
    provider: segments[0]?.provider ?? provider,
    segments: dedupeByMergeKey(segments),
    warnings,
  };
}
