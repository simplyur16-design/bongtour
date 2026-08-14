import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import { newTempId, parseKoDateOptionalTime } from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

/** Rakuten Travel reservation confirmation (KO) */
export function parseRakutenTravelText(text: string): TripParsedSegment[] {
  const bookingRef =
    text.match(/예약\s*ID\s*([0-9]+)/)?.[1] ||
    text.match(/예약\s*ID:\s*([0-9]+)/)?.[1] ||
    null;

  const property =
    text.match(/완료되었습니다\s*\.\s*\n\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/호텔\s+[^\n]+/)?.[0]?.trim() ||
    null;

  const address = text.match(/주소\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const phone = text.match(/전화\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const payAt = text.match(/결제\s*방법\s*([^\n]+)/)?.[1]?.trim() ?? null;

  const checkInLine = text.match(/체크인\s*([^\n]+)/)?.[1] ?? "";
  const checkOutLine = text.match(/체크아웃\s*([^\n]+)/)?.[1] ?? "";
  const inP = parseKoDateOptionalTime(checkInLine);
  const outP = parseKoDateOptionalTime(checkOutLine);

  const windowMatch = checkInLine.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
  const rooms = Number(text.match(/객실\s*수\s*(\d+)/)?.[1] ?? NaN);
  const roomType = text.match(/객실\s*([^\n]+)/)?.[1]?.trim() ?? null;
  const booker = text.match(/예약자명\s*([^\n]+)/)?.[1]?.trim() ?? null;

  const checkInAt = inP
    ? `${inP.date}T${(inP.time ?? "14:00").padStart(5, "0")}:00`
    : null;
  const checkOutAt = outP
    ? `${outP.date}T${(outP.time ?? "10:00").padStart(5, "0")}:00`
    : null;

  const payload = enrichHotelBilingual({
    type: "hotel",
    property_name: property,
    property_name_user: null,
    property_name_dest: null,
    address,
    address_user: null,
    address_dest: null,
    dest_lang: null,
    phone,
    check_in_at: checkInAt,
    check_out_at: checkOutAt,
    check_in_window: windowMatch?.[1] ?? null,
    rooms: Number.isFinite(rooms) ? rooms : null,
    room_type: roomType,
    guests_adults: null,
    guests_children: null,
    pay_at: payAt,
    booking_ref: bookingRef,
    travelers: booker ? [booker] : [],
  });

  return [
    finalizeParsedSegment({
      temp_id: newTempId("rkt"),
      type: "hotel",
      provider: "rakuten_travel",
      sort_at: checkInAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}
