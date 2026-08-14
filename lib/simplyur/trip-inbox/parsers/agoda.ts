import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { enrichHotelBilingual } from "@/lib/simplyur/trip-inbox/bilingual-hotel";
import { newTempId, parseKoDateOptionalTime } from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type { TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

function toIso(date: string, time?: string): string {
  return `${date}T${time ?? "14:00"}:00`;
}

/** Agoda booking confirmation PDF/email */
export function parseAgodaText(text: string): TripParsedSegment[] {
  const bookingRef =
    text.match(/Booking ID\s*:\s*[^\n]*?\n?\s*예약\s*번호\s*:\s*(\d+)/i)?.[1] ||
    text.match(/예약\s*번호\s*:\s*(\d+)/)?.[1] ||
    text.match(/Booking ID\s*:\s*(\d+)/i)?.[1] ||
    null;

  const property =
    text.match(/Property\s*:\s*[^\n]*숙소명\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/숙소명\s*:\s*([^\n]+)/)?.[1]?.trim() ||
    null;

  const address =
    text.match(/Address\s*:\s*[^\n]*주소\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    text.match(/주소\s*:\s*([^\n]+)/)?.[1]?.trim() ||
    null;

  const checkInRaw =
    text.match(/Arrival\s*:\s*[^\n]*체크인\s*:\s*([^\n]+)/i)?.[1] ||
    text.match(/체크인\s*:\s*([^\n]+)/)?.[1] ||
    "";
  const checkOutRaw =
    text.match(/Departure\s*:\s*[^\n]*체크아웃\s*:\s*([^\n]+)/i)?.[1] ||
    text.match(/체크아웃\s*:\s*([^\n]+)/)?.[1] ||
    "";

  const inP = parseKoDateOptionalTime(checkInRaw.replace(/\s+/g, " "));
  const outP = parseKoDateOptionalTime(checkOutRaw.replace(/\s+/g, " "));

  const rooms = Number(text.match(/객실\s*수\s*:\s*(\d+)/)?.[1] ?? NaN);
  const adults = Number(text.match(/성인\s*수\s*:\s*(\d+)/)?.[1] ?? NaN);
  const children = Number(text.match(/아동\s*수\s*:\s*(\d+)/)?.[1] ?? NaN);
  const roomType =
    text.match(/객실\s*타입\s*:\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/Room Type\s*:\s*[^\n]*객실\s*타입\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    null;
  const client =
    text.match(/고객명\s*:\s*([^\n]+)/)?.[1]?.trim() ||
    text.match(/Client\s*:\s*[^\n]*고객명\s*:\s*([^\n]+)/i)?.[1]?.trim() ||
    null;

  const checkInAt = inP ? toIso(inP.date, inP.time) : null;
  const checkOutAt = outP ? toIso(outP.date, outP.time ?? "11:00") : null;

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
    check_in_window: null,
    rooms: Number.isFinite(rooms) ? rooms : null,
    room_type: roomType,
    guests_adults: Number.isFinite(adults) ? adults : null,
    guests_children: Number.isFinite(children) ? children : null,
    pay_at: text.includes("Agoda") ? "agoda" : null,
    booking_ref: bookingRef,
    travelers: client ? [client] : [],
  });

  return [
    finalizeParsedSegment({
      temp_id: newTempId("agd"),
      type: "hotel",
      provider: "agoda",
      sort_at: checkInAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}
