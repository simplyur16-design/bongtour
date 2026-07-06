/**
 * Naver Booking (네이버 예약) integration — Korean operator channel.
 * Foreign visitors fill simplyur/Bong Tour forms (en/ja/zh/vi); server maps to Korean payload.
 */

export const NAVER_BOOKING_ENABLED = false as const;

/** Partner / seller ID from Naver Booking partner center (future). */
export const NAVER_BOOKING_PARTNER_ID_ENV = "NAVER_BOOKING_PARTNER_ID" as const;

/** API secret or OAuth client secret (server-only). */
export const NAVER_BOOKING_CLIENT_SECRET_ENV = "NAVER_BOOKING_CLIENT_SECRET" as const;

/** Base URL for Naver Booking API or browser automation endpoint (future). */
export const NAVER_BOOKING_API_BASE_ENV = "NAVER_BOOKING_API_BASE" as const;

export function getNaverBookingPartnerId(): string | null {
  const v = process.env.NAVER_BOOKING_PARTNER_ID?.trim();
  return v || null;
}

export function isNaverBookingConfigured(): boolean {
  return Boolean(getNaverBookingPartnerId() && process.env.NAVER_BOOKING_CLIENT_SECRET?.trim());
}
