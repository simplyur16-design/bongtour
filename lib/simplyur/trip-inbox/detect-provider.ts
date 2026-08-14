/**
 * Email / PDF source fingerprints for Trip Inbox parsers.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: provider detect — manifest
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: airbnb + airline e-ticket + OTA detect — manifest
 */
import type { TripProvider } from "@/lib/simplyur/trip-inbox/types";

export type TripProviderHint = {
  provider: TripProvider;
  /** Gmail OAuth query fragments (later) */
  gmailQueryHints: string[];
};

export const TRIP_PROVIDER_HINTS: readonly TripProviderHint[] = [
  {
    provider: "united",
    gmailQueryHints: ["from:receipts@united.com", "eTicket Itinerary"],
  },
  {
    provider: "trip_com",
    gmailQueryHints: ["from:trip.com", "from:kr_flt_noreply@trip.com", "from:kr_car_noreply@trip.com"],
  },
  {
    provider: "agoda",
    gmailQueryHints: ["from:agoda", "Booking Confirmation", "Booked And Payable Through"],
  },
  {
    provider: "rakuten_travel",
    gmailQueryHints: ["from:travel.rakuten.com", "라쿠텐 트래블", "Rakuten Travel"],
  },
  {
    provider: "bongtour_eticket",
    gmailQueryHints: ["전자항공권", "e-Ticket Itinerary", "주식회사봉투어", "Passenger Itinerary"],
  },
  {
    provider: "airbnb",
    gmailQueryHints: ["from:airbnb.com", "Airbnb", "Confirmation code"],
  },
  {
    provider: "booking_com",
    gmailQueryHints: ["from:booking.com", "Booking.com", "Pin code"],
  },
  {
    provider: "airline_eticket",
    gmailQueryHints: ["e-ticket", "electronic ticket", "전자항공권", "Passenger Itinerary"],
  },
  {
    provider: "klook",
    gmailQueryHints: ["from:klook.com", "Klook", "Booking confirmation"],
  },
  {
    provider: "experience_ota",
    gmailQueryHints: ["from:kkday.com", "from:getyourguide.com", "from:viator.com"],
  },
] as const;

const AIRLINE_ETICKET_MARKERS =
  /e-?ticket|electronic\s+ticket|전자\s*항공권|passenger\s+itinerary|승객\s*여정|boarding\s+pass|eTicket\s+Itinerary/i;

export function detectTripProvider(text: string): TripProvider {
  const t = text;
  const lower = t.toLowerCase();

  if (
    lower.includes("receipts@united.com") ||
    lower.includes("united airlines") ||
    /confirmation number:\s*\n?[a-z0-9]{5,6}/i.test(t)
  ) {
    if (lower.includes("united") || /UA\d{3,4}/.test(t)) return "united";
  }

  if (
    lower.includes("trip.com") ||
    t.includes("트립닷컴") ||
    lower.includes("kr_flt_noreply") ||
    lower.includes("kr_car_noreply") ||
    lower.includes("kr_flight@trip.com")
  ) {
    return "trip_com";
  }

  if (
    lower.includes("agoda") ||
    t.includes("Booked And Payable Through") ||
    (t.includes("Booking ID") && t.includes("체크인") && t.includes("숙소명"))
  ) {
    return "agoda";
  }

  if (
    lower.includes("rakuten") ||
    t.includes("라쿠텐") ||
    lower.includes("travel.rakuten.com")
  ) {
    return "rakuten_travel";
  }

  if (
    t.includes("주식회사봉투어") ||
    t.includes("전자항공권 발행확인서") ||
    t.includes("전자 항공권 발행 확인서") ||
    t.includes("승객 여정표") ||
    (t.includes("Passenger Itinerary") && (t.includes("봉투어") || /bong\s*tour/i.test(t)))
  ) {
    return "bongtour_eticket";
  }

  if (
    lower.includes("airbnb") ||
    lower.includes("airbnb.com") ||
    /confirmation code:\s*[A-Z0-9]{6,12}/i.test(t)
  ) {
    if (lower.includes("airbnb") || lower.includes("airbnb.com")) return "airbnb";
  }

  if (
    lower.includes("booking.com") ||
    lower.includes("bookingcom") ||
    (lower.includes("pin code") && lower.includes("confirmation number") && lower.includes("check-in"))
  ) {
    return "booking_com";
  }

  if (
    lower.includes("klook") ||
    lower.includes("klook.com") ||
    t.includes("클룩")
  ) {
    return "klook";
  }

  if (
    /kkday|getyourguide|viator|civitatis|headout|gyg\./i.test(t)
  ) {
    return "experience_ota";
  }

  if (
    /expedia|hotels\.com|hotwire|orbitz|travelocity|priceline|vrbo|tripadvisor|yanolja|여기어때|goodchoice|dailyhotel|hopper|kayak|makemytrip|hilton\.com|marriott|hyatt|ihg\.com|accor/i.test(
      t,
    )
  ) {
    return "generic_ota";
  }

  if (
    AIRLINE_ETICKET_MARKERS.test(t) ||
    (/\b([A-Z]{2})\s?-?\s?\d{2,4}\b/.test(t) && /PNR|ticket\s*number|편명|항공사/i.test(t))
  ) {
    return "airline_eticket";
  }

  return "unknown";
}
