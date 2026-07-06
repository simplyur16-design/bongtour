import type { BookingIntakeDto } from "@/lib/booking-intake-contract";
import { BOOKING_PRIVACY_NOTICE_VERSION } from "@/lib/booking-consent";
import {
  isNaverBookingConfigured,
  NAVER_BOOKING_ENABLED,
} from "./config";
import {
  mapToNaverBookingKoPayload,
  type NaverBookingLocaleIntake,
  type NaverBookingSubmitResult,
} from "./contract";

/**
 * Submit a foreign-locale booking to Naver Booking (stub until partner API wired).
 * Always produces BookingIntakeDto for internal /api/bookings parity.
 */
export async function submitNaverBooking(
  intake: NaverBookingLocaleIntake,
): Promise<NaverBookingSubmitResult> {
  if (!NAVER_BOOKING_ENABLED) {
    return { ok: false, error: "Naver Booking integration is not enabled.", code: "disabled" };
  }
  if (!isNaverBookingConfigured()) {
    return { ok: false, error: "Naver Booking credentials are not configured.", code: "not_configured" };
  }

  const ko = mapToNaverBookingKoPayload(intake);

  // TODO: build BookingIntakeDto + POST /api/bookings + Naver upstream when partner API is wired
  void ko;
  return {
    ok: false,
    error: "Naver Booking upstream submit is not implemented yet.",
    code: "upstream",
  };
}

/** Build internal booking DTO from locale intake (for /api/bookings when flow is enabled). */
export function buildBookingIntakeFromNaverLocale(intake: NaverBookingLocaleIntake): BookingIntakeDto {
  const ko = mapToNaverBookingKoPayload(intake);
  const childCount = intake.childWithBedCount + intake.childNoBedCount;
  const totalPax = intake.adultCount + childCount + intake.infantCount;

  return {
    productId: intake.productId,
    originSource: intake.originSource,
    originCode: intake.originCode,
    selectedDepartureDate: intake.selectedDepartureDate,
    customerName: ko.customerNameKo,
    customerNameKo: ko.customerNameKo,
    customerNameEn: ko.customerNameEn,
    customerBirthDate: intake.customerBirthDate,
    customerPhone: intake.customerPhone,
    customerEmail: intake.customerEmail,
    privacyAgreed: intake.privacyAgreed,
    privacyNoticeVersion: BOOKING_PRIVACY_NOTICE_VERSION,
    marketingConsent: intake.marketingConsent,
    totalPax,
    adultCount: intake.adultCount,
    childCount,
    childWithBedCount: intake.childWithBedCount,
    childNoBedCount: intake.childNoBedCount,
    infantCount: intake.infantCount,
    singleRoomRequested: intake.singleRoomRequested,
    preferredContactChannel: intake.preferredContactChannel,
    childInfantBirthDates: [],
    requestNotes: ko.memoKo,
  };
}
