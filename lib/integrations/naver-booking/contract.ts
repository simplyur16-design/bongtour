import type { BookingIntakeDto } from "@/lib/booking-intake-contract";
import type { SimplyurLocale } from "@/lib/simplyur/constants";

/**
 * Multilingual booking intake from simplyur / foreign-facing UI.
 * Maps to BookingIntakeDto (DB) + NaverBookingKoPayload (operator channel).
 */
export type NaverBookingLocaleIntake = {
  locale: SimplyurLocale;
  productId: string;
  originSource: string;
  originCode: string;
  selectedDepartureDate: string;
  /** Romanized or passport name — required for foreign visitors */
  customerNameEn: string;
  /** Optional Korean name if visitor has one */
  customerNameKo?: string | null;
  customerBirthDate: string;
  /** E.164 or local with country code */
  customerPhone: string;
  customerEmail: string;
  adultCount: number;
  childWithBedCount: number;
  childNoBedCount: number;
  infantCount: number;
  singleRoomRequested: boolean;
  preferredContactChannel: "phone" | "kakao" | "email";
  requestNotes?: string | null;
  privacyAgreed: boolean;
  marketingConsent: boolean;
};

/** Korean-facing payload shape for Naver Booking submission (fields TBD with partner docs). */
export type NaverBookingKoPayload = {
  partnerProductId: string;
  departureDate: string;
  customerNameKo: string;
  customerNameEn: string;
  customerPhone: string;
  customerEmail: string;
  adultCount: number;
  childCount: number;
  infantCount: number;
  memoKo: string;
  sourceLocale: SimplyurLocale;
};

export type NaverBookingSubmitResult =
  | { ok: true; naverReservationId: string; bookingIntake: BookingIntakeDto }
  | { ok: false; error: string; code: "disabled" | "not_configured" | "validation" | "upstream" };

/** Build Korean memo summarizing foreign-locale request notes for operator. */
export function buildNaverBookingMemoKo(intake: NaverBookingLocaleIntake): string {
  const parts: string[] = [`[simplyur locale: ${intake.locale}]`];
  if (intake.requestNotes?.trim()) parts.push(intake.requestNotes.trim());
  return parts.join("\n");
}

/** Map multilingual intake → Korean Naver payload (names fall back to English). */
export function mapToNaverBookingKoPayload(intake: NaverBookingLocaleIntake): NaverBookingKoPayload {
  const childCount = intake.childWithBedCount + intake.childNoBedCount;
  return {
    partnerProductId: intake.productId,
    departureDate: intake.selectedDepartureDate,
    customerNameKo: (intake.customerNameKo ?? intake.customerNameEn).trim(),
    customerNameEn: intake.customerNameEn.trim(),
    customerPhone: intake.customerPhone.trim(),
    customerEmail: intake.customerEmail.trim(),
    adultCount: intake.adultCount,
    childCount,
    infantCount: intake.infantCount,
    memoKo: buildNaverBookingMemoKo(intake),
    sourceLocale: intake.locale,
  };
}
