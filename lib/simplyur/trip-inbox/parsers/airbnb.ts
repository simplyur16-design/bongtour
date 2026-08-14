/**
 * Airbnb reservation confirmation (email / PDF text).
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: parseAirbnbText — manifest
 */
import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import {
  newTempId,
  parseEnDateOptionalTime,
  parseKoDateOptionalTime,
  toIsoLocal,
} from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

export function parseAirbnbText(text: string): TripParsedSegment[] {
  const bookingRef =
    text.match(/Confirmation code\s*[:\s]*([A-Z0-9]{6,12})/i)?.[1] ||
    text.match(/확인\s*코드\s*[:\s]*([A-Z0-9]{6,12})/i)?.[1] ||
    text.match(/예약\s*코드\s*[:\s]*([A-Z0-9]{6,12})/i)?.[1] ||
    null;

  const checkInRaw =
    text.match(/Check[- ]?in\s*[:\s]*([^\n]+)/i)?.[1] ||
    text.match(/체크인\s*[:\s]*([^\n]+)/)?.[1] ||
    "";
  const checkOutRaw =
    text.match(/Check[- ]?out\s*[:\s]*([^\n]+)/i)?.[1] ||
    text.match(/체크아웃\s*[:\s]*([^\n]+)/)?.[1] ||
    "";

  const inP = parseEnDateOptionalTime(checkInRaw) ?? parseKoDateOptionalTime(checkInRaw);
  const outP = parseEnDateOptionalTime(checkOutRaw) ?? parseKoDateOptionalTime(checkOutRaw);

  const property =
    text.match(/(?:Listing|Accommodation|숙소)\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/You're going to\s+([^\n]+)/i)?.[1]?.trim() ||
    text.match(/님이\s+([^\n]+)\s+에 갑니다/)?.[1]?.trim() ||
    null;

  const address =
    text.match(/Address\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/주소\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
    null;

  const guests = Number(text.match(/Guests?\s*[:\s]*(\d+)/i)?.[1] ?? NaN);
  const guestName =
    text.match(/Guest\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/게스트\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
    null;

  const checkInAt = inP ? toIsoLocal(inP.date, inP.time, "15:00") : null;
  const checkOutAt = outP ? toIsoLocal(outP.date, outP.time, "11:00") : null;

  const payload = enrichHotelBilingual({
    type: "hotel",
    property_name: property,
    property_name_user: null,
    property_name_dest: null,
    address,
    address_user: null,
    address_dest: null,
    dest_lang: null,
    phone: null,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    check_in_window: inP?.time ? `${inP.time}` : null,
    rooms: 1,
    room_type: "Airbnb listing",
    guests_adults: Number.isFinite(guests) ? guests : null,
    guests_children: null,
    pay_at: null,
    booking_ref: bookingRef,
    travelers: guestName ? [guestName] : [],
  });

  if (!property && !bookingRef && !checkInAt) return [];

  return [
    finalizeParsedSegment({
      temp_id: newTempId("abnb"),
      type: "hotel",
      provider: "airbnb",
      sort_at: checkInAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}
