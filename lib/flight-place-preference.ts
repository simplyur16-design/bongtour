/**
 * 출발/도착 표시 문자열 병합 — 공항명(긴 명칭)을 도시 단어보다 우선.
 */

function hasAirportWord(s: string): boolean {
  return /(?:국제공항|공항)/u.test(s)
}

/** DB·본문 후보 중 사용자 노출용으로 더 구체적인 공항/장소명 선택 */
export function preferRicherPlaceName(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = a?.replace(/\s+/g, ' ').trim() || ''
  const y = b?.replace(/\s+/g, ' ').trim() || ''
  if (!x) return y || null
  if (!y) return x || null
  if (x === y) return x
  const xA = hasAirportWord(x)
  const yA = hasAirportWord(y)
  if (xA && !yA) return x
  if (yA && !xA) return y
  if (x.includes(y) && x.length > y.length) return x
  if (y.includes(x) && y.length > x.length) return y
  return x.length >= y.length ? x : y
}
