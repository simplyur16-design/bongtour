/**
 * 목적지(destination) 문자열 정규화 — 이미지 자산 조회용 내부 키 생성 전용.
 *
 * 이 로직은 이미지 자산 추천용 내부 정규화이며,
 * Product.destination 등 상품 원문/일정 데이터는 절대 수정·덮어쓰지 않는다.
 * 공급사 원문은 그대로 두고, 조회 시에만 정규화된 키로 DestinationImageSet/PhotoPool을 찾는다.
 */

/** 구분자: 쉼표, 슬래시, 가운데점, 파이프 */
const SPLIT_REGEX = /[,/·|]\s*/

/**
 * 한글/영문 별칭 → 대표 키(한글) 매핑.
 * 키는 소문자(영문) 또는 한글 그대로. 값은 조회용 대표 도시명(한글).
 */
const DESTINATION_ALIASES: Record<string, string> = {
  // 다낭
  '다낭': '다낭',
  'da nang': '다낭',
  'danang': '다낭',
  // 호이안
  '호이안': '호이안',
  'hoi an': '호이안',
  'hoian': '호이안',
  // 오사카
  '오사카': '오사카',
  'osaka': '오사카',
  // 교토
  '교토': '교토',
  'kyoto': '교토',
  // 방콕
  '방콕': '방콕',
  'bangkok': '방콕',
  // 파타야
  '파타야': '파타야',
  'pattaya': '파타야',
  // 기타 자주 쓰는 도시
  '치앙마이': '치앙마이',
  'chiang mai': '치앙마이',
  '세부': '세부',
  'cebu': '세부',
  '나트랑': '나트랑',
  'nha trang': '나트랑',
  '싱가포르': '싱가포르',
  'singapore': '싱가포르',
  '도쿄': '도쿄',
  'tokyo': '도쿄',
  '후쿠오카': '후쿠오카',
  'fukuoka': '후쿠오카',
}

/**
 * 단일 토큰을 조회용 대표 키로 정규화.
 * alias에 없으면 trim된 원문 그대로 반환(알 수 없는 도시도 하나의 키로 사용).
 */
function normalizeToken(token: string): string {
  const t = token.trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  return DESTINATION_ALIASES[t] ?? DESTINATION_ALIASES[lower] ?? t
}

/**
 * 원문 destination 문자열을 구분자로 분리한 뒤, 각 토큰을 조회용 키로 정규화하여 배열로 반환.
 * 중복 제거, 순서 유지. Product.destination 원문은 수정하지 않는다.
 */
export function normalizeDestinationsForLookup(rawDestination: string | null | undefined): string[] {
  const raw = (rawDestination ?? '').trim()
  if (!raw) return []

  const tokens = raw.split(SPLIT_REGEX).map((s) => s.trim()).filter(Boolean)
  const keys = tokens.map(normalizeToken).filter(Boolean)
  const seen = new Set<string>()
  const result: string[] = []
  for (const k of keys) {
    if (!seen.has(k)) {
      seen.add(k)
      result.push(k)
    }
  }
  return result
}
