/**
 * Klook / KKDay / GetYourGuide / Viator activity confirmations.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: parseExperienceOtaText — manifest
 */
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import {
  newTempId,
  parseEnDateOptionalTime,
  parseIsoLikeLocal,
  parseKoDateOptionalTime,
  toIsoLocal,
} from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripExperienceSegmentPayload, TripParsedSegment, TripProvider } from "@/lib/simplyur/trip-inbox/types";

function firstInstant(raw: string, fallback = "10:00"): string | null {
  const iso = parseIsoLikeLocal(raw);
  if (iso) return iso;
  const en = parseEnDateOptionalTime(raw);
  if (en) return toIsoLocal(en.date, en.time, fallback);
  const ko = parseKoDateOptionalTime(raw);
  if (ko) return toIsoLocal(ko.date, ko.time, fallback);
  return null;
}

export function parseExperienceOtaText(text: string, provider: TripProvider = "experience_ota"): TripParsedSegment[] {
  const bookingRef =
    text.match(/(?:Booking|Confirmation|Order)\s*(?:reference|number|ID|#|code)?\s*[:#]?\s*([A-Z0-9-]{5,})/i)?.[1] ||
    text.match(/예약\s*(?:번호|코드)\s*[:\s]*([A-Z0-9-]{5,})/i)?.[1] ||
    null;

  const title =
    text.match(/(?:Activity|Experience|Tour|Attraction|상품명|체험)\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/You're booked for\s+([^\n]+)/i)?.[1]?.trim() ||
    null;

  const venue =
    text.match(/(?:Venue|Meeting point|Meeting location|집합)\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    null;

  const address =
    text.match(/Address\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/주소\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
    null;

  const startRaw =
    text.match(/(?:Date|Travel date|Experience date|이용일|날짜)\s*[:\s]*([^\n]+)/i)?.[1] ||
    text.match(/(?:Start(?:\s+time)?|Time)\s*[:\s]*([^\n]+)/i)?.[1] ||
    "";
  const timeRaw = text.match(/(?:Start(?:\s+time)?|Time|시간)\s*[:\s]*([^\n]+)/i)?.[1] ?? "";
  const startAt = firstInstant(`${startRaw} ${timeRaw}`.trim());

  const payload: TripExperienceSegmentPayload = {
    type: "experience",
    title,
    venue,
    address,
    start_at: startAt,
    end_at: null,
    booking_ref: bookingRef,
    travelers: [],
  };

  if (!title && !bookingRef && !startAt) return [];

  return [
    finalizeParsedSegment({
      temp_id: newTempId("exp"),
      type: "experience",
      provider,
      sort_at: startAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}

export function parseKlookText(text: string): TripParsedSegment[] {
  return parseExperienceOtaText(text, "klook");
}
