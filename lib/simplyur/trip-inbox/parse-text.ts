/**
 * Trip Inbox parse entry — detect provider, run parser, merge duplicates,
 * mine a form parser on unknown layouts, overlay learned corrections.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: parseTripInboxText — manifest
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: instant form parser + learn overlay — manifest
 */
import { detectTripProvider } from "@/lib/simplyur/trip-inbox/detect-provider";
import { parseAgodaText } from "@/lib/simplyur/trip-inbox/parsers/agoda";
import { parseAirbnbText } from "@/lib/simplyur/trip-inbox/parsers/airbnb";
import { parseAirlineEticketText } from "@/lib/simplyur/trip-inbox/parsers/airline-eticket";
import { parseBongtourEticketText } from "@/lib/simplyur/trip-inbox/parsers/bongtour-eticket";
import { parseBookingComText } from "@/lib/simplyur/trip-inbox/parsers/booking-com";
import { parseExperienceOtaText, parseKlookText } from "@/lib/simplyur/trip-inbox/parsers/experience-ota";
import { parseGenericOtaText } from "@/lib/simplyur/trip-inbox/parsers/generic-ota";
import { parseRakutenTravelText } from "@/lib/simplyur/trip-inbox/parsers/rakuten-travel";
import { parseTripComText } from "@/lib/simplyur/trip-inbox/parsers/trip-com";
import { parseUnitedText } from "@/lib/simplyur/trip-inbox/parsers/united";
import type {
  TripFormParser,
  TripParsedSegment,
  TripParseResult,
  TripProvider,
} from "@/lib/simplyur/trip-inbox/types";
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { newTempId } from "@/lib/simplyur/trip-inbox/date-parse";
import { sortTripSegmentsNearestNow } from "@/lib/simplyur/trip-inbox/timeline-sort";
import { fingerprintTripForm } from "@/lib/simplyur/trip-inbox/form-fingerprint";
import {
  applyFormParser,
  fillSegmentsFromFormParser,
  getFormParserByFingerprint,
  mineFormParser,
  stampSegments,
  upsertFormParser,
} from "@/lib/simplyur/trip-inbox/learned-parsers";

export type ParseTripInboxOptions = {
  /** Client-persisted form parsers from earlier corrections */
  formParsers?: TripFormParser[];
};

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
    case "airbnb":
      return parseAirbnbText(text);
    case "booking_com":
      return parseBookingComText(text);
    case "airline_eticket":
      return parseAirlineEticketText(text);
    case "generic_ota":
      return parseGenericOtaText(text);
    case "klook":
      return parseKlookText(text);
    case "experience_ota":
      return parseExperienceOtaText(text, "experience_ota");
    case "learned_form":
    case "unknown":
    default:
      return [];
  }
}

const FALLBACK_ORDER: TripProvider[] = [
  "united",
  "trip_com",
  "agoda",
  "rakuten_travel",
  "bongtour_eticket",
  "airbnb",
  "booking_com",
  "airline_eticket",
  "generic_ota",
  "klook",
  "experience_ota",
];

function placeholderSegment(provider: TripProvider): TripParsedSegment {
  return finalizeParsedSegment({
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
  });
}

function ingestClientParsers(parsers: TripFormParser[] | undefined): void {
  if (!parsers) return;
  for (const p of parsers) {
    if (p?.form_id && p.fingerprint && Array.isArray(p.rules)) upsertFormParser(p);
  }
}

export function parseTripInboxText(raw: string, opts?: ParseTripInboxOptions): TripParseResult {
  ingestClientParsers(opts?.formParsers);
  const text = raw.replace(/\u00a0/g, " ").trim();
  const warnings: string[] = [];
  const fingerprint = text ? fingerprintTripForm(text) : "";

  if (!text) {
    return {
      provider: "unknown",
      segments: [placeholderSegment("unknown")],
      warnings: ["empty_text"],
      source_fingerprint: "",
      form_parser: null,
    };
  }

  const provider = detectTripProvider(text);
  let segments = runProvider(provider, text);
  let formParser = getFormParserByFingerprint(fingerprint) ?? null;

  if (segments.length === 0 && provider !== "unknown") {
    warnings.push(`primary_empty:${provider}`);
  }
  if (segments.length === 0) {
    for (const p of FALLBACK_ORDER) {
      if (p === provider) continue;
      const tried = runProvider(p, text);
      if (tried.length) {
        segments = tried;
        warnings.push(`fallback_provider:${p}`);
        break;
      }
    }
  }

  if (formParser) {
    if (segments.length === 0) {
      segments = applyFormParser(formParser, text);
      warnings.push("applied_learned_form");
    } else {
      segments = fillSegmentsFromFormParser(segments, formParser, text);
    }
  }

  if (segments.length === 0 || segments.every((s) => s.status === "failed" || s.confidence < 0.35)) {
    const mined = mineFormParser(text, { provider: provider === "unknown" ? "learned_form" : provider, fingerprint });
    if (mined) {
      formParser = upsertFormParser(mined);
      const minedSegs = applyFormParser(mined, text);
      if (minedSegs.length && (segments.length === 0 || minedSegs[0]!.confidence > (segments[0]?.confidence ?? 0))) {
        segments = minedSegs;
        warnings.push("mined_form_parser");
      } else if (segments.length) {
        segments = fillSegmentsFromFormParser(segments, mined, text);
        warnings.push("mined_form_overlay");
      }
    }
  } else if (!formParser) {
    const mined = mineFormParser(text, { provider, fingerprint });
    if (mined) {
      formParser = upsertFormParser(mined);
      segments = fillSegmentsFromFormParser(segments, mined, text);
      warnings.push("mined_form_overlay");
    }
  }

  if (segments.length === 0) {
    warnings.push("no_segments");
    segments = [placeholderSegment(provider)];
  }

  const stamped = stampSegments(
    sortTripSegmentsNearestNow(dedupeByMergeKey(segments)),
    fingerprint,
    formParser?.form_id ?? null,
  );
  return {
    provider: stamped[0]?.provider ?? provider,
    segments: stamped,
    warnings,
    source_fingerprint: fingerprint,
    form_parser: formParser,
  };
}
