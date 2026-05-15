/**
 * 메모리 #30 — cron HTTP 라우트 공통 인증.
 * 구현 SSOT는 `bongtour-cron-auth` (헤더 `x-bongtour-cron-secret` ↔ `BONGTOUR_CRON_SECRET`).
 */
export { getBongtourCronSecret, isAuthorizedCronRequest } from '@/lib/bongtour-cron-auth'
