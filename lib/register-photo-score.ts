/**
 * 사진 자동 고르기 점수 (원래 규칙: 품질 점수 우선 + 최근 사용 감점 + 같은 도시 안에서 돌려쓰기, 대표≠일차).
 * 순수 함수 — DB·네트워크 없음. 최근 사용 정보는 호출부가 RecentUseIndex 로 넘긴다.
 * REGRESSION-FREEZE[register-photo-score]: 품질 − 최근 사용 감점 − 같은 도시 사용 감점, 대표·일차 중복 제거 — manifest
 */
import { IMAGE_MIN_WIDTH } from '@/lib/product-image-source-policy'

export type ScoreCandidate = {
  url: string
  externalId?: string | null
  tier?: string | null
  width?: number | null
  height?: number | null
  altText?: string | null
  pageUrl?: string | null
}

export type RecentUse = {
  /** 최근 기간(기본 90일) 다른 상품에서 쓴 횟수 */
  uses: number
  /** 마지막 사용 후 지난 일수 */
  lastUsedDaysAgo: number | null
  /** 같은 도시(목적지) 다른 상품에서 쓴 횟수 — 돌려쓰기 */
  sameCityUses: number
}

export type RecentUseIndex = Map<string, RecentUse>

export const RECENT_USE_WINDOW_DAYS = 90
export const RECENT_USE_HOT_DAYS = 30

export function normPhotoUrl(u: string | null | undefined): string {
  const s = String(u ?? '').trim()
  try {
    const x = new URL(s)
    x.search = ''
    x.hash = ''
    return x.href.toLowerCase()
  } catch {
    return s.toLowerCase()
  }
}

/** 같은 사진을 찾는 키: 정규화한 주소 + (있으면) 출처:외부 id */
export function photoUsageKeys(c: { url: string; externalId?: string | null; tier?: string | null }): string[] {
  const keys = [normPhotoUrl(c.url)]
  const t = String(c.tier ?? '').toLowerCase()
  if (c.externalId && t) keys.push(`${t}:${String(c.externalId).trim()}`)
  return keys.filter(Boolean)
}

export function lookupRecentUse(index: RecentUseIndex | null | undefined, c: ScoreCandidate): RecentUse | undefined {
  if (!index) return undefined
  let best: RecentUse | undefined
  for (const k of photoUsageKeys(c)) {
    const r = index.get(k)
    if (!r) continue
    if (!best) best = { ...r }
    else {
      best.uses = Math.max(best.uses, r.uses)
      best.sameCityUses = Math.max(best.sameCityUses, r.sameCityUses)
      if (r.lastUsedDaysAgo != null && (best.lastUsedDaysAgo == null || r.lastUsedDaysAgo < best.lastUsedDaysAgo))
        best.lastUsedDaysAgo = r.lastUsedDaysAgo
    }
  }
  return best
}

function slugWords(pageUrl: string | null | undefined): string {
  try {
    return new URL(String(pageUrl ?? '')).pathname.replace(/[-_/]+/g, ' ').toLowerCase()
  } catch {
    return ''
  }
}

/** 품질 점수: 해상도 · 가로형 비율 · 키워드(장소) 일치. 1200px 미만은 크게 깎는다(사실상 탈락). */
export function photoQualityScore(c: ScoreCandidate, keywords: readonly string[] = []): number {
  const w = typeof c.width === 'number' && c.width > 0 ? c.width : null
  const h = typeof c.height === 'number' && c.height > 0 ? c.height : null
  let s = 0
  if (w != null) {
    if (w < IMAGE_MIN_WIDTH) return -1000
    s += Math.min(40, (w - IMAGE_MIN_WIDTH) / 50)
  }
  if (w != null && h != null) {
    const r = w / h
    if (r >= 1.3 && r <= 2.1) s += 15
    else if (r >= 1.0) s += 5
    else s -= 20
  }
  const meta = `${String(c.altText ?? '').toLowerCase()} ${slugWords(c.pageUrl)}`
  const tokens = new Set(
    keywords
      .flatMap((k) => String(k ?? '').toLowerCase().split(/[\s,·/]+/))
      .map((t) => t.trim())
      .filter((t) => t.length >= 3)
  )
  let hit = 0
  for (const t of tokens) if (meta.includes(t)) hit += 10
  s += Math.min(30, hit)
  return s
}

/** 최근 사용 감점 + 같은 도시 돌려쓰기 감점 */
export function recentUsePenalty(r: RecentUse | undefined): number {
  if (!r) return 0
  let p = Math.min(30, r.uses * 6)
  if (r.lastUsedDaysAgo != null && r.lastUsedDaysAgo <= RECENT_USE_HOT_DAYS) p += 15
  p += Math.min(40, r.sameCityUses * 10)
  return p
}

export type ScoreContext = { keywords?: readonly string[]; recent?: RecentUseIndex | null }

export function scorePhoto(c: ScoreCandidate, ctx: ScoreContext = {}): number {
  return photoQualityScore(c, ctx.keywords ?? []) - recentUsePenalty(lookupRecentUse(ctx.recent, c))
}

/** 점수 높은 순(같으면 원래 순서) */
export function rankPhotosByScore<T extends ScoreCandidate>(cands: readonly T[], ctx: ScoreContext = {}): T[] {
  return cands
    .map((c, i) => ({ c, i, s: scorePhoto(c, ctx) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c)
}

/** 같은 도시 풀 사진 돌려쓰기: 최근에 덜 쓴 사진부터(같으면 원래 순서 = sortOrder) */
export function rotatePoolWithinCity<T extends { filePath: string; sourcePhotoId?: string | null; source?: string | null }>(
  list: readonly T[],
  recent: RecentUseIndex | null | undefined
): T[] {
  return list
    .map((rec, i) => ({
      rec,
      i,
      p: recentUsePenalty(
        lookupRecentUse(recent, { url: rec.filePath, externalId: rec.sourcePhotoId ?? null, tier: rec.source ?? null })
      ),
    }))
    .sort((a, b) => a.p - b.p || a.i - b.i)
    .map((x) => x.rec)
}

/** 대표≠일차: 대표 사진과 같은 일차 사진, 일차끼리 겹치는 사진은 비운다(뒤쪽 일차를 비움) */
export function dropDayPhotosDuplicatingMain<T extends { url: string } | null>(mainUrl: string, days: readonly T[]): T[] {
  const seen = new Set<string>([normPhotoUrl(mainUrl)])
  return days.map((d) => {
    if (!d) return d
    const k = normPhotoUrl(d.url)
    if (seen.has(k)) return null as T
    seen.add(k)
    return d
  })
}
