import { HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS } from '@/lib/products-browse-hub-prefetch-timeout'
import {
  readProductsBrowseClientCache,
  writeProductsBrowseClientCache,
} from '@/lib/products-browse-client-cache'

type BrowseOkJson = { ok: true; items: unknown[] }

const inflightByKey = new Map<string, Promise<BrowseOkJson>>()

/**
 * 허브 `/api/products/browse` — 탭 내 동일 queryKey 중복 fetch 합류.
 * effect cleanup abort 없음(취소 루프로 loading 영구 true 방지).
 */
export async function fetchProductsBrowseClientJson(queryKey: string): Promise<BrowseOkJson> {
  const key = queryKey.trim()
  if (!key) throw new Error('목록 요청 키가 비어 있습니다.')

  const hit = readProductsBrowseClientCache<BrowseOkJson>(key)
  if (hit?.ok && Array.isArray(hit.items) && hit.items.length > 0) return hit

  const inflight = inflightByKey.get(key)
  if (inflight) return inflight

  const work = (async () => {
    const controller = new AbortController()
    const abortTimer = window.setTimeout(() => controller.abort(), HUB_BROWSE_CLIENT_FETCH_TIMEOUT_MS)
    try {
      const res = await fetch(`/api/products/browse?${key}`, { signal: controller.signal })
      const json = (await res.json()) as BrowseOkJson | { ok: false; error?: string }
      if (!res.ok || !('ok' in json) || json.ok === false) {
        throw new Error(
          typeof (json as { error?: string }).error === 'string'
            ? (json as { error: string }).error
            : '목록을 불러오지 못했습니다.',
        )
      }
      writeProductsBrowseClientCache(key, json)
      return json
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(
          '목록 응답이 지연되고 있습니다. 잠시 후 새로고침하거나 다른 메뉴에서 다시 시도해 주세요.',
        )
      }
      throw e
    } finally {
      window.clearTimeout(abortTimer)
    }
  })().finally(() => {
    if (inflightByKey.get(key) === work) inflightByKey.delete(key)
  })

  inflightByKey.set(key, work)
  return work
}
