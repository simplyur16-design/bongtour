/**
 * Other booking tools (Expedia, Hotels.com, Klook, Vrbo, hotel-direct, …).
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: parseGenericOtaText — manifest
 */
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import {
  newTempId,
  parseEnDateOptionalTime,
  parseIsoLikeLocal,
  parseKoDateOptionalTime,
  toIsoLocal,
} from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

function firstDate(raw: string, fallbackTime: string): string | null {
  const iso = parseIsoLikeLocal(raw);
  if (iso) return iso;
  const en = parseEnDateOptionalTime(raw);
  if (en) return toIsoLocal(en.date, en.time, fallbackTime);
  const ko = parseKoDateOptionalTime(raw);
  if (ko) return toIsoLocal(ko.date, ko.time, fallbackTime);
  return null;
}

export function parseGenericOtaText(text: string): TripParsedSegment[] {
  const bookingRef =
    text.match(/(?:Confirmation|Itinerary|Booking|Reservation)\s*(?:number|ID|#|code)?\s*[:#]?\s*([A-Z0-9.-]{5,})/i)?.[1] ||
    text.match(/예약\s*(?:번호|ID|코드)\s*[:\s]*([A-Z0-9.-]{5,})/i)?.[1] ||
    null;

  const property =
    text.match(/(?:Hotel|Property|Listing|Accommodation|Stay)\s*(?:name|title)?\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/(?:숙소명|호텔명|시설명)\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
    null;

  const address =
    text.match(/Address\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/주소\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
    null;

  const checkInRaw =
    text.match(/(?:Check[- ]?in|Arrival)(?:\s+date)?\s*[:\s]*([^\n]+)/i)?.[1] ||
    text.match(/체크인\s*[:\s]*([^\n]+)/)?.[1] ||
    "";
  const checkOutRaw =
    text.match(/(?:Check[- ]?out|Departure)(?:\s+date)?\s*[:\s]*([^\n]+)/i)?.[1] ||
    text.match(/체크아웃\s*[:\s]*([^\n]+)/)?.[1] ||
    "";

  const checkInAt = firstDate(checkInRaw, "14:00");
  const checkOutAt = firstDate(checkOutRaw, "11:00");

  const payload = enrichHotelBilingual({
    type: "hotel",
    property_name: property,
    property_name_user: null,
    property_name_dest: null,
    address,
    address_user: null,
    address_dest: null,
    dest_lang: null,
    phone: text.match(/Phone\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ?? null,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    check_in_window: null,
    rooms: Number(text.match(/Rooms?\s*[:\s]*(\d+)/i)?.[1] ?? NaN) || null,
    room_type: text.match(/Room(?:\s+type)?\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ?? null,
    guests_adults: Number(text.match(/(?:Adults?|Guests?)\s*[:\s]*(\d+)/i)?.[1] ?? NaN) || null,
    guests_children: null,
    pay_at: null,
    booking_ref: bookingRef,
    travelers: [],
  });

  if (!property && !bookingRef && !checkInAt) return [];

  return [
    finalizeParsedSegment({
      temp_id: newTempId("ota"),
      type: "hotel",
      provider: "generic_ota",
      sort_at: checkInAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}
