/**
 * 상품 목록 수집(야간 Playwright ingest) 게이트.
 * 기본 OFF — 가격 sweep과 분리. 다시 켤 때 ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1
 * REGRESSION-FREEZE[register-listing-ingest-opt-in]: listing ingest default off — manifest
 */
export function isRegisterListingIngestCronEnabled(): boolean {
  if (process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON === "1") return false;
  return process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST === "1";
}
