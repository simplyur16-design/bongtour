/**
 * YMD(`YYYY-MM-DD`) 순수 유틸 — 클라이언트·서버 공용.
 * `product-sales-policy` 등 서버 전용 모듈에 의존하지 않는다.
 */

/** YMD(`YYYY-MM-DD`) ± delta 일. UTC 기준(달력 일자 SSOT). */
export function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/** KST 기준 오늘(`YYYY-MM-DD`). */
export function kstTodayYmd(): string {
  const now = new Date()
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000
  return new Date(kstMs).toISOString().slice(0, 10)
}
