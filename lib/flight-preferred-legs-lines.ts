function stripNoise(s: string): string {
  return s.replace(/\blogo-[a-z0-9_-]+\b/gi, ' ').replace(/\s+/g, ' ').trim()
}

/** 항공 선호 구간 휴리스틱용 — 본문 한 덩어리를 줄 단위로 정규화 */
export function splitFlightSectionLinesForPreferredLegs(section: string): string[] {
  return section
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => stripNoise(l).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
