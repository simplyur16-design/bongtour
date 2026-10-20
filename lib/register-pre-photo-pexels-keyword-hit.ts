/**
 * 등록대기 imageKeyword — Pexels 실장소 사진 hit 필수 (언어 무관·오장소 거절).
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: manifest
 */
import { pexelsKeywordHasPhotos } from '@/lib/pexels-service'
import {
  imageKeywordHasPlaceIdentity,
  resolvePexelsImageKeywordForSearch,
} from '@/lib/pexels-keyword-place-photo-hit'
import { isBlockedScheduleImageKeyword } from '@/lib/schedule-image-keyword-blocklist'

export type RegisterPrePhotoPexelsHitMap = ReadonlyMap<string, boolean>

export type RegisterPrePhotoPexelsHitRow = {
  day?: number | null
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type RegisterPrePhotoPexelsHitNote = {
  day: number
  field: 'imageKeyword' | 'imageKeyword2' | string
  reason: string
}

/** 동기: hitMap에서 false인 키워드를 비운다 (테스트·힐 공통). */
export function clearRegisterPrePhotoKeywordsMissingPexelsHit<T extends RegisterPrePhotoPexelsHitRow>(
  rows: readonly T[],
  hitMap: RegisterPrePhotoPexelsHitMap,
  notes?: RegisterPrePhotoPexelsHitNote[],
): T[] {
  return rows.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    let nextKw = kw
    let nextKw2: string | null = kw2 || null
    if (kw && hitMap.has(kw) && hitMap.get(kw) === false) {
      notes?.push({ day: Number(row.day) || 0, field: 'imageKeyword', reason: 'keyword_pexels_miss' })
      nextKw = ''
    }
    if (kw2 && hitMap.has(kw2) && hitMap.get(kw2) === false) {
      notes?.push({ day: Number(row.day) || 0, field: 'imageKeyword2', reason: 'keyword_pexels_miss' })
      nextKw2 = null
    }
    if (!nextKw && nextKw2) {
      nextKw = nextKw2
      nextKw2 = null
    }
    if (nextKw === kw && nextKw2 === (kw2 || null)) return row
    return { ...row, imageKeyword: nextKw, imageKeyword2: nextKw2 }
  })
}

/** 유니크 키워드를 Pexels에 조회해 hitMap 생성 (원문 키 → 정규화 검색). */
export async function probeRegisterPrePhotoPexelsKeywordHits(
  keywords: readonly string[],
  opts?: { maxUnique?: number; delayMs?: number },
): Promise<Map<string, boolean>> {
  const maxUnique = Math.min(40, Math.max(1, opts?.maxUnique ?? 16))
  // REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: 사람처럼 간격 — 연타 429 방지 — manifest
  const delayMs = Math.max(0, opts?.delayMs ?? 220)
  const uniq: string[] = []
  const seen = new Set<string>()
  for (const raw of keywords) {
    const k = String(raw ?? '').trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    uniq.push(k)
    if (uniq.length >= maxUnique) break
  }
  const map = new Map<string, boolean>()
  for (let i = 0; i < uniq.length; i++) {
    const k = uniq[i]!
    const search = resolvePexelsImageKeywordForSearch(k) || k
    map.set(k, await pexelsKeywordHasPhotos(search))
    if (delayMs > 0 && i + 1 < uniq.length) {
      await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  return map
}

export function collectScheduleImageKeywords(
  rows: readonly { imageKeyword?: string | null; imageKeyword2?: string | null }[],
): string[] {
  const out: string[] = []
  for (const r of rows) {
    const a = String(r.imageKeyword ?? '').trim()
    const b = String(r.imageKeyword2 ?? '').trim()
    if (a) out.push(a)
    if (b) out.push(b)
  }
  return out
}

/**
 * route 있는 날의 키워드만 — 빈 route 날은 invent strip 대상이라 live Pexels 연타 생략.
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: 빈 route 상품에서도 유효일 kw는 검사 — manifest
 */
export function collectScheduleImageKeywordsOnRoutedDays(
  rows: readonly RegisterPrePhotoPexelsHitRow[],
): string[] {
  const out: string[] = []
  for (const r of rows) {
    if (Number(r.day) > 0 && !String(r.routeText ?? '').trim()) continue
    const a = String(r.imageKeyword ?? '').trim()
    const b = String(r.imageKeyword2 ?? '').trim()
    if (a) out.push(a)
    if (b) out.push(b)
  }
  return out
}

function keywordFailsStaticPlaceIdentity(raw: string): boolean {
  const k = String(raw ?? '').trim()
  if (!k) return false
  if (isBlockedScheduleImageKeyword(k)) return true
  if (!imageKeywordHasPlaceIdentity(k)) return true
  return false
}

/**
 * API 없이 차단·비해소 스크립트·장소 고유명 없는 키워드 제거.
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]: static place identity — manifest
 */
export function clearRegisterPrePhotoKeywordsFailingPlaceIdentityStatic<
  T extends RegisterPrePhotoPexelsHitRow,
>(rows: readonly T[], notes?: RegisterPrePhotoPexelsHitNote[]): T[] {
  return rows.map((row) => {
    const kw = String(row.imageKeyword ?? '').trim()
    const kw2 = String(row.imageKeyword2 ?? '').trim()
    let nextKw = kw
    let nextKw2: string | null = kw2 || null
    if (kw && keywordFailsStaticPlaceIdentity(kw)) {
      notes?.push({ day: Number(row.day) || 0, field: 'imageKeyword', reason: 'keyword_pexels_miss' })
      nextKw = ''
    }
    if (kw2 && keywordFailsStaticPlaceIdentity(kw2)) {
      notes?.push({ day: Number(row.day) || 0, field: 'imageKeyword2', reason: 'keyword_pexels_miss' })
      nextKw2 = null
    }
    if (!nextKw && nextKw2) {
      nextKw = nextKw2
      nextKw2 = null
    }
    if (nextKw === kw && nextKw2 === (kw2 || null)) return row
    return { ...row, imageKeyword: nextKw, imageKeyword2: nextKw2 }
  })
}
