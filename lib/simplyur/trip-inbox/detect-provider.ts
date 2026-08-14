/**
 * Email / PDF source fingerprints for Trip Inbox parsers.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: provider detect — manifest
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
] as const;

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
    t.includes("Passenger Itinerary")
  ) {
    return "bongtour_eticket";
  }

  return "unknown";
}
