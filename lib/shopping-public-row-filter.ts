/**
 * 공개 상세 쇼핑 표 — 표 헤더·요약 한 줄이 데이터 행으로 들어온 경우 제거.
 */

import type { ShoppingStopRow } from '@/lib/public-product-extras-types'

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

const HEADER_TOKENS = new Set(
  [
    '구분',
    '내용',
    '쇼핑품목',
    '쇼핑 항목',
    '쇼핑항목',
    '쇼핑장소',
    '쇼핑 장소',
    '소요시간',
    '예상소요시간',
    '환불여부',
    '환불',
    '현지',
    '귀국',
    '쇼핑 횟수',
    '쇼핑횟수',
  ].map(norm)
)

/** 헤더 행·요약-only 행 */
export function isShoppingPublicJunkRow(row: ShoppingStopRow): boolean {
  const item = (row.itemType ?? '').replace(/\s+/g, ' ').trim()
  const place = (row.placeName ?? '').replace(/\s+/g, ' ').trim()
  if (!item && !place) return true
  const fused = `${item} ${place}`
  if (/구분\s*[/／|｜]\s*내용|쇼핑\s*품목\s*[/／|｜]\s*쇼핑\s*장소|쇼핑\s*항목\s*[/／|｜]\s*쇼핑\s*장소/i.test(fused)) return true
  if (/소요\s*시간.*환불|환불\s*여부.*소요/i.test(fused) && fused.length > 25) return true
  if (/쇼핑장소\s+소요시간|소요시간\s+현지|쇼핑항목\s+쇼핑장소|현지\s*\/\s*귀국\s*후\s*환불/i.test(fused)) return true
  if (/^총\s*\d+\s*회/.test(item) || /^총\s*\d+\s*회/.test(place)) return true
  const ni = norm(item)
  const np = norm(place)
  if (HEADER_TOKENS.has(ni) && (HEADER_TOKENS.has(np) || fused.length > 35)) return true
  if (ni === norm('구분') && /쇼핑|환불|소요|품목|장소|횟수/i.test(place) && place.length > 12) return true
  if (ni === norm('쇼핑장소') && /소요시간|현지|환불|귀국/i.test(place)) return true
  if (np === norm('환불여부') && HEADER_TOKENS.has(ni)) return true
  const words = fused.split(/\s+/).filter(Boolean)
  if (words.length >= 3) {
    const headerWordHits = words.filter((w) => HEADER_TOKENS.has(norm(w))).length
    if (headerWordHits >= 3) return true
  }
  return false
}

/** DB shoppingItems 한 덩어리가 표 헤더만 나열한 경우 */
export function isShoppingItemsSummaryJunk(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  const t = text.replace(/\s+/g, ' ').trim()
  if (/쇼핑장소\s+소요시간|구분\s*[,，、/]\s*쇼핑항목|쇼핑항목\s*[,，、/]\s*쇼핑장소/i.test(t)) return true
  const parts = t.split(/[,，、/]\s*/).map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2 && parts.every((p) => HEADER_TOKENS.has(norm(p)))) return true
  const words = t.split(/\s+/).filter(Boolean)
  if (words.length >= 3 && words.filter((w) => HEADER_TOKENS.has(norm(w))).length >= 3) return true
  return false
}

export function filterShoppingStopsForPublicDisplay(rows: ShoppingStopRow[]): ShoppingStopRow[] {
  return rows.filter((r) => !isShoppingPublicJunkRow(r))
}
