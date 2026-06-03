/**
 * browse 목록 API 응답 — 같은 탭·뒤로가기 시 즉시 복원용(세션 저장).
 * 서버 `unstable_cache` 와 별개; 클라이언트 `/api/products/browse` 재요청만 줄인다.
 */
const STORAGE_KEY = 'bt-browse-cache-v1'
const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 16

type CacheEntry = {
  at: number
  data: unknown
}

function readStore(): Record<string, CacheEntry> {
  if (typeof sessionStorage === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: Record<string, CacheEntry>) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // quota / private mode — 무시
  }
}

function prune(store: Record<string, CacheEntry>): Record<string, CacheEntry> {
  const now = Date.now()
  const entries = Object.entries(store).filter(([, v]) => now - v.at <= TTL_MS)
  entries.sort((a, b) => b[1].at - a[1].at)
  const kept = entries.slice(0, MAX_ENTRIES)
  return Object.fromEntries(kept)
}

export function readProductsBrowseClientCache<T>(queryKey: string): T | null {
  const key = queryKey.trim()
  if (!key) return null
  const store = prune(readStore())
  writeStore(store)
  const hit = store[key]
  if (!hit || Date.now() - hit.at > TTL_MS) return null
  return hit.data as T
}

export function writeProductsBrowseClientCache(queryKey: string, data: unknown): void {
  const key = queryKey.trim()
  if (!key) return
  const store = prune(readStore())
  store[key] = { at: Date.now(), data }
  writeStore(prune(store))
}
