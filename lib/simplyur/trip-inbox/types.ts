/**
 * Simplyur Trip Inbox — itinerary segment SSOT (TripIt-like).
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: parse status + segment types — manifest
 */

export const TRIP_SEGMENT_TYPES = ["flight", "hotel", "car"] as const;
export type TripSegmentType = (typeof TRIP_SEGMENT_TYPES)[number];

/** Parser / user review pipeline */
export const TRIP_PARSE_STATUSES = ["confirmed", "needs_review", "failed"] as const;
export type TripParseStatus = (typeof TRIP_PARSE_STATUSES)[number];

export const TRIP_PROVIDERS = [
  "united",
  "trip_com",
  "agoda",
  "rakuten_travel",
  "bongtour_eticket",
  "unknown",
] as const;
export type TripProvider = (typeof TRIP_PROVIDERS)[number];

export type TripTravelerName = string;

export type TripFlightSegmentPayload = {
  type: "flight";
  flight_no: string | null;
  airline: string | null;
  operated_by: string | null;
  dep_airport: string | null;
  arr_airport: string | null;
  dep_city: string | null;
  arr_city: string | null;
  dep_terminal: string | null;
  arr_terminal: string | null;
  /** ISO-8601 local wall time when timezone unknown; prefer with offset */
  dep_at: string | null;
  arr_at: string | null;
  cabin_class: string | null;
  status: string | null;
  duration: string | null;
  aircraft: string | null;
  baggage: string | null;
  pnr: string | null;
  ticket_number: string | null;
  booking_ref: string | null;
  travelers: TripTravelerName[];
};

export type TripHotelSegmentPayload = {
  type: "hotel";
  property_name: string | null;
  /** Visitor / Latin (or user-locale) property name */
  property_name_user: string | null;
  /** Destination-local script name (KO/JA/ZH …) */
  property_name_dest: string | null;
  address: string | null;
  address_user: string | null;
  address_dest: string | null;
  /** Inferred local language at the property */
  dest_lang: "ko" | "ja" | "zh" | "en" | null;
  phone: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_window: string | null;
  rooms: number | null;
  room_type: string | null;
  guests_adults: number | null;
  guests_children: number | null;
  pay_at: string | null;
  booking_ref: string | null;
  travelers: TripTravelerName[];
};

export type TripCarSegmentPayload = {
  type: "car";
  vehicle_class: string | null;
  pickup_at: string | null;
  dropoff_at: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  branch_phone: string | null;
  booking_ref: string | null;
  travelers: TripTravelerName[];
};

export type TripSegmentPayload =
  | TripFlightSegmentPayload
  | TripHotelSegmentPayload
  | TripCarSegmentPayload;

export type TripParsedSegment = {
  /** Client/temp id before persist */
  temp_id: string;
  type: TripSegmentType;
  provider: TripProvider;
  status: TripParseStatus;
  /** 0..1 */
  confidence: number;
  /** Timeline sort key ISO */
  sort_at: string | null;
  /** Dedupe key e.g. flight|UA1349|2026-08-09|BOS|ORD */
  merge_key: string | null;
  payload: TripSegmentPayload;
  /** Missing / invalid field paths for correction UI */
  issues: string[];
};

export type TripParseResult = {
  provider: TripProvider;
  segments: TripParsedSegment[];
  warnings: string[];
};

export type TripSegmentCorrectionPatch = {
  status?: TripParseStatus;
  sort_at?: string | null;
  payload: Partial<
    Omit<TripFlightSegmentPayload, "type"> &
      Omit<TripHotelSegmentPayload, "type"> &
      Omit<TripCarSegmentPayload, "type">
  > & { type?: TripSegmentType };
};

export function isTripParseStatus(v: string): v is TripParseStatus {
  return (TRIP_PARSE_STATUSES as readonly string[]).includes(v);
}

export function isTripSegmentType(v: string): v is TripSegmentType {
  return (TRIP_SEGMENT_TYPES as readonly string[]).includes(v);
}
