/**
 * 공개 UI용 HTML 엔티티 디코드 — 공급사 원문에 남은 `&rarr;` `&hearts` 등이
 * React 텍스트 노드에 그대로 보이지 않게 한다.
 * 세미콜론 생략형(`&rarr`)도 허용.
 */

const NAMED: Record<string, string> = {
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
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
