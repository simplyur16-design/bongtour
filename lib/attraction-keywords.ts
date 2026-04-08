/**
 * 관광지 키워드 추출 — 이미지 자산 조회용.
 *
 * 원문(title / destination)에 **명시적으로 등장하는** 관광지명만 사용한다.
 * 원문에 없는 관광지를 추론·상상하지 않는다. "원문에 보이면 매칭, 안 보이면 안 씀" 원칙.
 */

/** PhotoPool.attractionName 등과 매칭할 때 쓰는 관광지 키워드 목록(한글). 원문에 이 문자열이 포함되어 있을 때만 사용. */
export const ALLOWED_ATTRACTION_KEYWORDS: string[] = [
  '바나힐',
  '미케비치',
  '내원교',
  '오사카성',
  '유니버설',
  '유니버설스튜디오',
  '스튜디오재팬',
  '도톨',
  '나가시마',
  '시라카와고',
  '아리랑',
  '청담',
  '한류',
]

/**
 * 원문 텍스트(title + destination 등)에서 위 허용 목록에 있는 관광지 키워드만 추출.
 * 부분 일치(포함) 기준. 대소문자 구분 없이 한글 키워드만 사용.
 * 반환값은 중복 제거된 배열.
 */
export function extractAttractionKeywordsFromText(text: string | null | undefined): string[] {
  const raw = (text ?? '').trim()
  if (!raw) return []

  const found: string[] = []
  for (const keyword of ALLOWED_ATTRACTION_KEYWORDS) {
    if (raw.includes(keyword)) {
      found.push(keyword)
    }
  }
  return Array.from(new Set(found))
}
