/**
 * 허브 RSC — browse prefetch 상한. 초과 시 null 반환(페이지는 즉시 렌더, 클라이언트가 API 재시도).
 * DB·cron 부하 시 Suspense 무한 대기 방지.
 */
export const HUB_BROWSE_RSC_PREFETCH_TIMEOUT_MS = 7_000

/** 클라이언트 `/api/products/browse` fetch 상한 */
export const HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS = 28_000

export function hubBrowsePrefetchWithTimeout<T>(
  work: Promise<T | null>,
  timeoutMs: number = HUB_BROWSE_RSC_PREFETCH_TIMEOUT_MS,
): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (value: T | null) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const timer = setTimeout(() => {
      console.warn('[hub-browse-prefetch] timeout', { timeoutMs })
      finish(null)
    }, timeoutMs)
    void work
      .then((v) => finish(v))
      .catch((e) => {
        console.error('[hub-browse-prefetch] error', e)
        finish(null)
      })
      .finally(() => clearTimeout(timer))
  })
}
