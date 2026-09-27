/**
 * 상품 목록 수집(야간 Playwright ingest) 게이트.
 * 기본 OFF — 가격 sweep·대기열 힐과 분리. 다시 켤 때 ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST=1
 * REGRESSION-FREEZE[register-listing-ingest-opt-in]: listing ingest default off — manifest
 */
export function isRegisterListingIngestCronEnabled(): boolean {
  return process.env.ENABLE_REGISTER_PRE_PHOTO_LISTING_INGEST === '1'
}

/**
 * 등록대기 키워드·일정 셀프힐 cron (수집과 무관).
 * 기본 ON. 끌 때 DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON=1
 * REGRESSION-FREEZE[register-pre-photo-heal-cron-always]: ingest off여도 heal cron 유지 — manifest
 */
export function isRegisterPrePhotoHealOnlyCronEnabled(): boolean {
  return process.env.DISABLE_REGISTER_PRE_PHOTO_SELF_HEAL_CRON !== '1'
}
