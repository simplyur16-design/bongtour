/**
 * 사이트맵 본문 캐시 — 신선하면 DB 없이 응답, 만료되면 시간 제한 안에서 재생성, 실패·초과 시 마지막 정상본.
 * REGRESSION-FREEZE[seo-image-sitemap-last-good]: 생성 실패·지연이 서치 콘솔 '가져올 수 없음'(5xx·타임아웃)이 되지 않게 마지막 정상본 또는 빈 urlset 을 200 으로 — manifest
 */

export type LastGoodCacheOptions = {
  /** 이 시간 안에는 재생성하지 않는다 */
  freshMs: number
  /** 재생성 허용 시간 — 넘기면 마지막 정상본(없으면 fallback) */
  timeoutMs: number
  now?: () => number
}

export type LastGoodResult<T> = { value: T; source: 'fresh' | 'rebuilt' | 'stale' | 'fallback' }

export function createLastGoodCache<T>(opts: LastGoodCacheOptions) {
  const now = opts.now ?? Date.now
  let good: { value: T; at: number } | null = null
  let inflight: Promise<T> | null = null

  function rebuild(loader: () => Promise<T>): Promise<T> {
    if (!inflight) {
      const p = loader()
        .then((value) => {
          good = { value, at: now() }
          return value
        })
        .finally(() => {
          inflight = null
        })
      // 시간 초과로 버려진 재생성이 늦게 실패해도 미처리 거부가 되지 않게
      p.catch(() => undefined)
      inflight = p
    }
    return inflight
  }

  async function get(loader: () => Promise<T>, fallback: () => T): Promise<LastGoodResult<T>> {
    if (good && now() - good.at < opts.freshMs) return { value: good.value, source: 'fresh' }
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('last_good_cache_timeout')), opts.timeoutMs)
      })
      const value = await Promise.race([rebuild(loader), timeout])
      return { value, source: 'rebuilt' }
    } catch (e) {
      console.error('[last-good-cache] rebuild failed — serving last good', e)
      if (good) return { value: good.value, source: 'stale' }
      return { value: fallback(), source: 'fallback' }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  function reset() {
    good = null
    inflight = null
  }

  return { get, reset }
}
