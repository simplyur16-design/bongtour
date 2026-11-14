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
  /** 이번 호출에서 실제로 새로 채운 칸 수. 없으면 로그에 넣지 않는다. */
  filled?: number
}

export function providerErrorClass(err: unknown): string {
  if (err instanceof Error && err.name) return err.name
  return 'Error'
}

export function logAutoPhotoAttempt(entry: AutoPhotoAttemptLog): void {
  const line: Record<string, unknown> = {
    kind: 'auto-photo-attempt',
    productId: entry.productId,
    day: entry.day,
    gate: entry.gate,
    providerErrorClass: entry.providerErrorClass,
    attemptAt: entry.attemptAt,
    result: entry.result,
  }
  if (typeof entry.filled === 'number') line.filled = entry.filled
  console.log(JSON.stringify(line))
}
