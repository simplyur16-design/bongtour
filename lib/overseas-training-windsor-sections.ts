/**
 * 윈저·패키지 상품 paste에서 「상품 고유 설명」 vs 「여행준비·약관」 블록을 분리.
 * 유럽 상품은 하단 안내문(안전정보·예약유의·취소·여권·보험·준비물)이 거의 동일한 경우가 많음.
 */

export type WindsorPrepSection = { title: string; items: string[] }

/** 윈저 상세 탭/아코디언에 자주 나오는 여행준비·약관 제목 */
export const WINDSOR_PREP_SECTION_TITLES = [
  '해외여행 안전정보',
  '예약시 유의사항',
  '취소수수료',
  '여권/비자',
  '여행자보험',
  '여행준비물',
  '기타사항',
] as const

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 본문에서 첫 번째 여행준비·약관 블록 시작 위치 */
export function findWindsorPrepBlockStart(text: string): number {
  let earliest = -1
  for (const title of WINDSOR_PREP_SECTION_TITLES) {
    const re = new RegExp(
      `(?:^|[\\r\\n])[\\t\\s]*${escapeRegExp(title)}[\\t\\s]*(?:[\\r\\n]|$)`,
      'im'
    )
    const m = re.exec(text)
    if (m && (earliest < 0 || m.index < earliest)) earliest = m.index
  }
  return earliest
}

function bodyToPrepItems(body: string): string[] {
  const trimmed = body.replace(/\r\n/g, '\n').trim()
  if (!trimmed) return []

  const bySpade = trimmed.split(/(?:^|\n)\s*♠\s+/m).map((s) => s.trim()).filter(Boolean)
  if (bySpade.length > 1) return bySpade

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (paragraphs.length > 0) return paragraphs

  return [trimmed]
}

/**
 * paste 꼬리(여행준비·약관 구간)를 제목별 JSON 섹션으로 분리.
 */
export function extractWindsorPrepSectionsFromText(tail: string): WindsorPrepSection[] {
  const normalized = tail.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const titlePattern = WINDSOR_PREP_SECTION_TITLES.map(escapeRegExp).join('|')
  const splitRe = new RegExp(
    `(?:^|[\\n])[\\t\\s]*(${titlePattern})[\\t\\s]*(?=\\n|$)`,
    'gim'
  )

  const sections: WindsorPrepSection[] = []
  let lastTitle: string | null = null
  let lastEnd = 0
  let m: RegExpExecArray | null

  while ((m = splitRe.exec(normalized)) !== null) {
    if (lastTitle != null) {
      const body = normalized.slice(lastEnd, m.index).trim()
      const items = bodyToPrepItems(body)
      if (items.length > 0) sections.push({ title: lastTitle, items })
    }
    lastTitle = m[1]!.trim()
    lastEnd = m.index + m[0].length
  }

  if (lastTitle != null) {
    const body = normalized.slice(lastEnd).trim()
    const items = bodyToPrepItems(body)
    if (items.length > 0) sections.push({ title: lastTitle, items })
  }

  return sections
}

export type WindsorPasteSplit = {
  /** 첫 여행준비·약관 헤더 이전 = 상품설명·일정 후보 */
  programBody: string
  prepSections: WindsorPrepSection[]
  hasGenericPrepBlock: boolean
}

export function splitWindsorPasteForTraining(programPaste: string): WindsorPasteSplit {
  const text = programPaste.replace(/\r\n/g, '\n')
  const prepStart = findWindsorPrepBlockStart(text)
  const programBody = (prepStart >= 0 ? text.slice(0, prepStart) : text).trim()
  const prepTail = prepStart >= 0 ? text.slice(prepStart).trim() : ''
  const prepSections = extractWindsorPrepSectionsFromText(prepTail)

  return {
    programBody,
    prepSections,
    hasGenericPrepBlock: prepSections.length >= 3,
  }
}

/** programBody 안에서 N일차 일정 후보 추출 (윈저 paste) */
export function extractScheduleDaysFromProgramBody(
  programBody: string
): Array<{ day: number; description: string }> {
  const text = programBody.replace(/\r\n/g, '\n')
  const out: Array<{ day: number; description: string }> = []
  const seen = new Set<number>()

  const patterns = [
    /(?:^|\n)\s*(?:제\s*)?(\d{1,2})\s*일(?:차)?\s*[:：\-]?\s*([^\n]+(?:\n(?!\s*(?:제\s*)?\d{1,2}\s*일).+)*)/gim,
    /(?:^|\n)\s*DAY\s*0?(\d{1,2})\b\s*[:：\-]?\s*([^\n]+(?:\n(?!\s*DAY\s*\d).+)*)/gim,
  ]

  for (const re of patterns) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(text)) !== null) {
      const day = parseInt(m[1]!, 10)
      const desc = (m[2] ?? '').trim().replace(/\n{3,}/g, '\n\n')
      if (!Number.isFinite(day) || day < 1 || day > 31 || !desc || seen.has(day)) continue
      seen.add(day)
      out.push({ day, description: desc.slice(0, 4000) })
    }
  }

  return out.sort((a, b) => a.day - b.day)
}
