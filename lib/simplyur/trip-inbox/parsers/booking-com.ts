/**
 * Booking.com hotel confirmation.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: parseBookingComText — manifest
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

export function parseBookingComText(text: string): TripParsedSegment[] {
  const bookingRef =
    text.match(/Confirmation(?:\s+number)?\s*[:\s]*([0-9.]+)/i)?.[1] ||
    text.match(/예약\s*(?:번호|확인)\s*[:\s]*([0-9.]+)/)?.[1] ||
    null;
  const pin = text.match(/Pin code\s*[:\s]*(\d+)/i)?.[1] ?? null;

  const property =
    text.match(/Hotel(?:\s+name)?\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/Property\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/숙소명\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
    null;

  const address =
    text.match(/Address\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/주소\s*[:\s]*([^\n]+)/)?.[1]?.trim() ||
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
  const checkInAt = inP ? toIsoLocal(inP.date, inP.time, "14:00") : null;
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
    check_in_window: inP?.time ?? null,
    rooms: Number(text.match(/Rooms?\s*[:\s]*(\d+)/i)?.[1] ?? NaN) || null,
    room_type: text.match(/Room(?:\s+type)?\s*[:\s]*([^\n]+)/i)?.[1]?.trim() ?? null,
    guests_adults: Number(text.match(/Adults?\s*[:\s]*(\d+)/i)?.[1] ?? NaN) || null,
    guests_children: Number(text.match(/Children\s*[:\s]*(\d+)/i)?.[1] ?? NaN) || null,
    pay_at: pin ? `pin:${pin}` : null,
    booking_ref: bookingRef,
    travelers: [],
  });

  if (!property && !bookingRef && !checkInAt) return [];

  return [
    finalizeParsedSegment({
      temp_id: newTempId("bkc"),
      type: "hotel",
      provider: "booking_com",
      sort_at: checkInAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}
