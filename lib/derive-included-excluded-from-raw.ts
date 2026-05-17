/**
 * rawMeta.structuredSignals.detailBodyNormalizedRaw 박힌 raw 본문에서
 * 포함/불포함 사항 추출. parser 박힌 로직 SSOT.
 *
 * 사용처: Product.includedText·excludedText 박힌 거 null일 때 fallback.
 * 봉사장 어드민 입력 박힌 데이터 = 우선. DB null일 때만 박힘.
 */

const SECTION_END_RES: RegExp[] = [
  /^예약\s*시\s*유의\s*사항/i,
  /^예약시\s*유의사항/i,
  /^여행\s*시\s*유의\s*사항/i,
  /^여행시\s*유의사항/i,
  /^미팅정보/i,
  /^여행\s*상세\s*정보/i,
  /^#\s*선택옵션/i,
  /^선택관광명/i,
]

function norm1(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function findIdx(lines: string[], re: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(norm1(lines[i] || ''))) return i
  }
  return -1
}

function cleanItems(rawLines: string[]): string[] {
  const items: string[] = []
  for (const line of rawLines) {
    const t = norm1(line)
    if (!t) continue
    if (t.length > 480) continue
    if (/^포함\/불포함\s*사항/i.test(t)) continue
    if (/^MODE'S\s*EVENT/i.test(t)) continue
    if (/^every\s*one\s*event/i.test(t)) continue
    items.push(t)
  }
  return items
}

export function deriveIncludedExcludedFromRaw(
  rawText: string | null | undefined
): { includedItems: string[]; excludedItems: string[] } {
  if (!rawText) return { includedItems: [], excludedItems: [] }

  const lines = rawText.split(/\r?\n/)
  const iInc = findIdx(lines, /^포함\s*사항\s*[:：]?\s*$/i)
  const iExc = findIdx(lines, /^불포함\s*사항\s*[:：]?\s*$/i)

  if (iInc < 0 || iExc < 0 || iExc <= iInc) {
    return { includedItems: [], excludedItems: [] }
  }

  let excEnd = lines.length
  for (let i = iExc + 1; i < lines.length; i++) {
    const t = norm1(lines[i] || '')
    if (SECTION_END_RES.some((re) => re.test(t))) {
      excEnd = i
      break
    }
  }

  const incRaw = lines.slice(iInc + 1, iExc)
  const excRaw = lines.slice(iExc + 1, excEnd)

  return {
    includedItems: cleanItems(incRaw),
    excludedItems: cleanItems(excRaw),
  }
}
