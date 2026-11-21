/**
 * 썸네일·대표 사진 고르기.
 * 공급사 사진은 사용권이 확인되지 않아 쓰지 않는다.
 * 같은 장소 묶음에서는 덜 쓴 사진부터 고르고, 그 묶음 안에서는 상품 id 해시로 고정해 돌아간다.
 * 모자랄 때만 이미 쓴 사진을 다시 쓴다. 한 상품의 일차 사진끼리 겹치지 않는 규칙은 이 함수가 바꾸지 않는다.
 * REGRESSION-FREEZE[thumbnail-least-used-1121]: 공급사 URL 제외·적은 사용·상품 id 회전 — manifest
 */

const SUPPLIER_PHOTO_HOSTS = [
  'hanatour.com',
  'modetour.com',
  'verygoodtour.com',
  'ybtour.com',
  'ybtour.co.kr',
  'lottetour.com',
  'kyowontour.com',
  'naeiltour.com',
  'naeiltour.co.kr',
  'hanjintour.com',
  'yellowballoon.co.kr',
] as const

const SUPPLIER_SOURCE_RE =
  /^(hanatour|modetour|verygoodtour|ybtour|lottetour|kyowontour|naeiltour|hanjintour|yellowballoon)$/i

export function isSupplierPhotoUrl(raw: string | null | undefined): boolean {
  const s = String(raw ?? '').trim()
  if (!s) return false
  let host = s.toLowerCase()
  try {
    host = new URL(s).hostname.toLowerCase()
  } catch {
    /* 주소가 아니면 출처 문자열로 본다 */
  }
  host = host.replace(/^www\./, '')
  return SUPPLIER_PHOTO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))
}

export function isSupplierPhotoSource(raw: string | null | undefined): boolean {
  return SUPPLIER_SOURCE_RE.test(String(raw ?? '').trim())
}

/** 상품 id 기준 고정 인덱스. 같은 id는 항상 같은 칸이다. */
export function thumbnailRotationIndex(productId: string, count: number): number {
  if (count <= 1) return 0
  let h = 2166136261
  const s = String(productId ?? '')
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) % count
}

/**
 * 사용 횟수가 가장 적은 사진만 먼저 둔다. 그 묶음은 상품 id로 돌려 나란한 카드가 다른 사진이 되게 한다.
 * 더 많이 쓴 사진은 뒤에 둔다(앞 사진이 빠질 때만 다시 씀).
 */
export function orderThumbnailCandidates<T>(items: readonly T[], productId: string, useCount: (item: T) => number): T[] {
  if (items.length <= 1) return [...items]
  const counts = items.map((item) => {
    const n = useCount(item)
    return Number.isFinite(n) && n > 0 ? n : 0
  })
  const min = Math.min(...counts)
  const least: T[] = []
  const rest: Array<{ item: T; uses: number; i: number }> = []
  items.forEach((item, i) => {
    if (counts[i] === min) least.push(item)
    else rest.push({ item, uses: counts[i] ?? 0, i })
  })
  const start = thumbnailRotationIndex(productId, least.length)
  const rotated = start === 0 ? least : [...least.slice(start), ...least.slice(0, start)]
  rest.sort((a, b) => a.uses - b.uses || a.i - b.i)
  return [...rotated, ...rest.map((r) => r.item)]
}
