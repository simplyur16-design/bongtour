/**
 * 자동 사진·백필 시도 로그. 비밀·쿠키·URL 쿼리는 넣지 않는다.
 * REGRESSION-FREEZE[auto-photo-missing-day-fill]: 구조화 로그 — manifest
 */
export type AutoPhotoAttemptLog = {
  productId: string
  day: number | null
  gate: string
  providerErrorClass: string | null
  attemptAt: string
  result: 'filled' | 'failed' | 'skipped'
}

export function providerErrorClass(err: unknown): string {
  if (err instanceof Error && err.name) return err.name
  return 'Error'
}

export function logAutoPhotoAttempt(entry: AutoPhotoAttemptLog): void {
  const line = {
    kind: 'auto-photo-attempt',
    productId: entry.productId,
    day: entry.day,
    gate: entry.gate,
    providerErrorClass: entry.providerErrorClass,
    attemptAt: entry.attemptAt,
    result: entry.result,
  }
  console.log(JSON.stringify(line))
}
