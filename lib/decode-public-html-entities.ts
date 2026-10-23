/**
 * 공개 UI용 HTML 엔티티 디코드 — 공급사 원문에 남은 `&rarr;` `&harr;` `&hearts` 등이
 * React 텍스트 노드에 그대로 보이지 않게 한다.
 * 세미콜론 생략형(`&rarr`)도 허용.
 * REGRESSION-FREEZE[decode-public-html-entities]: harr·공개 제목 엔티티 — manifest
 */

/** 「홍콩실속 홍콩실속」·연속 동일 토큰 붕괴 — 제목·dest 공통 */
export function collapseAdjacentDuplicateTitlePhrases(s: string): string {
  let t = String(s || '').replace(/\s+/g, ' ').trim()
  if (!t) return t
  t = t.replace(/([가-힣A-Za-z0-9]{2,})(?:\s+\1)+/gu, '$1')
  t = t.replace(/([가-힣]{2,8})\1+/gu, '$1')
  return t.replace(/\s{2,}/g, ' ').trim()
}

const NAMED: Record<string, string> = {
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  lrarr: '↔',
  hArr: '⇔',
  lrArr: '⇔',
  hearts: '♥',
  heart: '♥',
  middot: '·',
  bull: '•',
  mdash: '—',
  ndash: '–',
  times: '×',
  plusmn: '±',
  deg: '°',
  nbsp: ' ',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
}

export function decodePublicHtmlEntities(input: string): string {
  if (!input || !input.includes('&')) return input

  let s = input
  s = s.replace(/&#x([0-9a-fA-F]+);?/g, (_, hex: string) => {
    const cp = Number.parseInt(hex, 16)
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : _
  })
  s = s.replace(/&#(\d+);?/g, (_, dec: string) => {
    const cp = Number(dec)
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : _
  })
  s = s.replace(/&([a-zA-Z]+);?/g, (full, name: string) => {
    const key = name.toLowerCase()
    if (Object.prototype.hasOwnProperty.call(NAMED, key)) return NAMED[key]!
    return full
  })
  // amp는 다른 엔티티를 재도입할 수 있어 마지막에
  s = s.replace(/&amp;?/gi, '&')
  return s
}

export function decodePublicHtmlEntitiesMaybe(
  input: string | null | undefined,
): string | null | undefined {
  if (input == null) return input
  return decodePublicHtmlEntities(input)
}
