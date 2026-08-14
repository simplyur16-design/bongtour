import { finalizeParsedSegment } from "@/lib/simplyur/trip-inbox/confidence";
import { newTempId, parseIsoLikeLocal, parseKoDateTime } from "@/lib/simplyur/trip-inbox/date-parse";
import { buildMergeKey } from "@/lib/simplyur/trip-inbox/merge-key";
import type {
  TripCarSegmentPayload,
  TripFlightSegmentPayload,
  TripParsedSegment,
} from "@/lib/simplyur/trip-inbox/types";

function bookingRefFromTrip(text: string): string | null {
  const m =
    text.match(/항공사\s*예약번호\s*\(PNR\)\s*:\s*([A-Z0-9]+)/i) ||
    text.match(/트립닷컴\s*예약번호\s*([A-Z0-9]+)/i) ||
    text.match(/예약번호\s+([A-Z0-9]{5,})/i);
  return m?.[1]?.trim() ?? null;
}

/** Trip.com flight confirmation / e-receipt (KO) */
export function parseTripComFlightText(text: string): TripParsedSegment[] {
  const bookingRef = bookingRefFromTrip(text);
  const pnrMatch = text.match(/항공사\s*예약번호\s*\(PNR\)\s*:\s*([A-Z0-9]+)/i);
  const pnr = pnrMatch?.[1]?.trim() ?? bookingRef;

  const travelers: string[] = [];
  const nameBlock = text.match(/탑승객\s*이름[^]*?총\s*금액/i);
  if (nameBlock) {
    for (const nm of nameBlock[0].matchAll(/([A-Z][A-Z\s/]+)\s+[A-Z0-9]{5,}/g)) {
      travelers.push(nm[1].trim());
    }
  }
  const hwang = text.match(/([A-Z]+)\s*\(성\)\s*([A-Z]+)\s*\(이름\)/);
  if (hwang) travelers.push(`${hwang[1]}/${hwang[2]}`);

  const out: TripParsedSegment[] = [];

  // Pattern A: "출발 : 2026년 9월 7일 08:25" city lines
  const legsA = [...text.matchAll(/출발\s*:\s*([^\n]+)\n\s*도착\s*:\s*([^\n]+)/g)];
  const routeHint = text.match(/항공편\s*상세정보\s*([^\n]+)/);
  const cities = routeHint?.[1]?.split(/\s*-\s*/).map((s) => s.trim()) ?? [];

  legsA.forEach((leg, i) => {
    const depAt = parseKoDateTime(leg[1]);
    const arrAt = parseKoDateTime(leg[2]);
    const payload: TripFlightSegmentPayload = {
      type: "flight",
      flight_no: null,
      airline: "Trip.com booking",
      operated_by: null,
      dep_airport: null,
      arr_airport: null,
      dep_city: cities[i * 2] ?? cities[0] ?? null,
      arr_city: cities[i * 2 + 1] ?? cities[1] ?? null,
      dep_terminal: null,
      arr_terminal: null,
      dep_at: depAt,
      arr_at: arrAt,
      cabin_class: null,
      status: null,
      duration: null,
      aircraft: null,
      baggage: null,
      pnr,
      ticket_number: null,
      booking_ref: bookingRef,
      travelers,
    };
    out.push(
      finalizeParsedSegment({
        temp_id: newTempId("tripf"),
        type: "flight",
        provider: "trip_com",
        sort_at: depAt,
        merge_key: buildMergeKey(payload),
        payload,
      }),
    );
  });

  // Pattern B: "07:35ICN ... 아시아나항공 OZ701"
  // RegExp ctor — oxc chokes on fullwidth pipe / Hangul inside /.../ literals.
  const legsBRe = new RegExp(
    [
      "(\\d{2}:\\d{2})\\s*([A-Z]{3})\\s*([^\\n]*)\\n",
      "\\s*([^\\n]*?)([A-Z]{2}\\d{2,4})\\s*[|\\uFF5C]\\s*([^\\n]+)\\n",
      "\\s*(?:(\\d{1,2}\\uC6D4\\s*\\d{1,2}\\uC77C)\\s*\\n)?",
      "\\s*(\\d{2}:\\d{2})\\s*([A-Z]{3})",
    ].join(""),
    "g",
  );
  const legsB = [...text.matchAll(legsBRe)];
  for (const m of legsB) {
    // Need year from nearby "2026년 7월 29일"
    const yearCtx = text.match(/(\d{4})\s*\uB144/);
    const year = yearCtx?.[1] ?? "2026";
    const dateLine = text.match(
      new RegExp(`\uAC00\uB294\uD3B8:[^]*?(\\d{4})\uB144\\s*(\\d{1,2})\uC6D4\\s*(\\d{1,2})\uC77C`),
    );
    const retLine = text.match(
      new RegExp(`\uC624\uB294\uD3B8:[^]*?(\\d{4})\uB144\\s*(\\d{1,2})\uC6D4\\s*(\\d{1,2})\uC77C`),
    );
    const isReturn =
      out.length > 0 && /\uC624\uB294\uD3B8/.test(text.slice(0, m.index ?? 0).slice(-80));
    const d = isReturn && retLine ? retLine : dateLine;
    const ymd = d
      ? `${d[1]}-${d[2].padStart(2, "0")}-${d[3].padStart(2, "0")}`
      : `${year}-01-01`;
    const depAt = `${ymd}T${m[1]}:00`;
    let arrAt = `${ymd}T${m[8]}:00`;
    if (m[7]) {
      const dm = m[7].match(/(\d{1,2})\uC6D4\s*(\d{1,2})\uC77C/);
      if (dm) {
        arrAt = `${year}-${dm[1].padStart(2, "0")}-${dm[2].padStart(2, "0")}T${m[8]}:00`;
      }
    }
    const payload: TripFlightSegmentPayload = {
      type: "flight",
      flight_no: m[5].toUpperCase(),
      airline: m[4].replace(/\s+/g, " ").trim() || null,
      operated_by: null,
      dep_airport: m[2],
      arr_airport: m[9],
      dep_city: m[3].trim() || null,
      arr_city: null,
      dep_terminal: null,
      arr_terminal: null,
      dep_at: depAt,
      arr_at: arrAt,
      cabin_class: m[6]?.split("|")[0]?.trim() || null,
      status: null,
      duration: null,
      aircraft: null,
      baggage: null,
      pnr,
      ticket_number: null,
      booking_ref: bookingRef,
      travelers,
    };
    out.push(
      finalizeParsedSegment({
        temp_id: newTempId("tripf"),
        type: "flight",
        provider: "trip_com",
        sort_at: depAt,
        merge_key: buildMergeKey(payload),
        payload,
      }),
    );
  }

  return out;
}

/** Trip.com car pickup reminder */
export function parseTripComCarText(text: string): TripParsedSegment[] {
  const bookingRef = bookingRefFromTrip(text);
  const pickup =
    text.match(/인수시간은\s*([0-9\-:\s]+)\s*\(현지/i) ||
    text.match(/인수시간은\s*([0-9\-:\s]+)/i);
  const pickupAt = pickup ? parseIsoLikeLocal(pickup[1].trim()) : null;
  const vehicle =
    text.match(/예약하신\s*(.+?또는\s*동급\s*차종)/) ||
    text.match(/예약하신\s*(.+?)\s*렌터카/);
  const loc =
    text.match(/([^\s]+에서)\s*예약하신/) ||
    text.match(/렌터카\s*인수\s*&\s*반납\s*안내\s*\(([^)]+)\)/);
  const phone = text.match(/\+(\d[\d\-]+)/)?.[0] ?? null;
  const who = text.match(/([A-Z/]+)\s*님,\s*안녕하세요/)?.[1] ?? null;

  const payload: TripCarSegmentPayload = {
    type: "car",
    vehicle_class: vehicle?.[1]?.trim() ?? null,
    pickup_at: pickupAt,
    dropoff_at: null,
    pickup_location: loc?.[1]?.replace(/에서$/, "").trim() ?? null,
    dropoff_location: null,
    branch_phone: phone,
    booking_ref: bookingRef,
    travelers: who ? [who] : [],
  };
  return [
    finalizeParsedSegment({
      temp_id: newTempId("tripc"),
      type: "car",
      provider: "trip_com",
      sort_at: pickupAt,
      merge_key: buildMergeKey(payload),
      payload,
    }),
  ];
}

export function parseTripComText(text: string): TripParsedSegment[] {
  if (/렌터카/.test(text) && /인수/.test(text)) return parseTripComCarText(text);
  return parseTripComFlightText(text);
}
