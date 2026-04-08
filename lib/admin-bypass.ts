/**
 * 개발용 관리자 바이패스 (ADMIN_BYPASS_SECRET + ?auth= 또는 admin_bypass 쿠키).
 *
 * ## 허용 조건 (모두 충족할 때만)
 * - `NODE_ENV === 'development'` (next dev 전용; test/staging 빌드 등은 제외)
 * - `NODE_ENV !== 'production'` (이중 봉인)
 * - `VERCEL_ENV !== 'production'` (Vercel 운영 배포에서 실수로 우회가 켜지는 것 방지)
 * - `BONGTOUR_DEV_ADMIN_BYPASS === 'true'` (로컬에서만 명시적으로 켤 것 — 저장소 기본값 false)
 * - `ADMIN_BYPASS_SECRET` 설정 + 쿠키/쿼리 일치 (`isAdminBypassAllowed`)
 *
 * 운영·프리뷰(staging 성격)·`NODE_ENV=production` 에서는 이 모듈의 우회 분기가 절대 true가 되지 않게 고정한다.
 */
export const ADMIN_BYPASS_COOKIE_NAME = 'admin_bypass'

/** 로컬 개발에서 임시 우회 기능 자체를 켤 때만 true (secret 일치 여부와 별개) */
export function isDevAdminBypassRuntimeAllowed(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.VERCEL_ENV === 'production') return false
  if (process.env.NODE_ENV !== 'development') return false
  return process.env.BONGTOUR_DEV_ADMIN_BYPASS === 'true'
}

export type AdminBypassCheckInput = {
  cookieValue: string | undefined
  /** URL 쿼리 `auth` 값 (페이지 진입 또는 API URL에 붙인 경우) */
  authQuery: string | undefined
}

export function isAdminBypassAllowed(input: AdminBypassCheckInput): boolean {
  if (!isDevAdminBypassRuntimeAllowed()) return false
  const secret = process.env.ADMIN_BYPASS_SECRET
  if (!secret || secret.length === 0) return false
  return input.authQuery === secret || input.cookieValue === secret
}
