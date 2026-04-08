/**
 * 공개 상세 포함/불포함 — 헤더 기준 결정적 분리·오분류 라인 이동·1인실 중복 제거(LLM 없음).
 */

const HEADER_INCLUDED = /^(?:[-*•◇◆\d]+[\.\)]\s*)?포함\s*내역\s*[:：]?\s*$/i
const HEADER_EXCLUDED = /^(?:[-*•◇◆\d]+[\.\)]\s*)?불포함\s*내역\s*[:：]?\s*$/i

/** 저장 문자열에 남은 단독 라벨 줄만 제거(공급사 전용 파서로 이미 나뉜 2컬럼은 재해석하지 않음) */
const STORED_IE_LABEL_HEADER_ONLY =
  /^(?:[-*•◇◆\d]+[\.\)]\s*)?(?:포함사항|불포함사항|포함\s*\/\s*불포함\s*\/\s*선택경비|포함\s*\/\s*불포함|포함내역|불포함내역|선택경비|O\s*포함사항|O\s*불포함사항|포함\s*사항|불포함\s*사항)[:：]?\s*$/i

/** 포함·불포함 탭에 넣지 않을 단독 제목 줄(참좋은·모두 등 본문 헤더가 잘못 저장된 경우) */
const STANDALONE_DROP_FROM_PUBLIC_IE_TABS =
  /^(?:예약\s*시\s*유의\s*사항|예약시\s*유의사항|여행\s*시\s*유의\s*사항|여행시\s*유의사항|상품평점|미팅장소|미팅장소보기)\s*$/i

/** 포함 블록에 있으면 안 되는 문장(불포함·주의 성격) → 불포함/비고로 보냄 */
const LINE_BELONGS_EXCLUDED_NOT_INCLUDED =
  /(?:가이드\s*[&＆]\s*기사|기사\s*[&＆]\s*가이드).*경비.*불포함|불포함\s*되어.*추가\s*경비|^불포함\s*내역\s*$|본\s*상품은\s*전\s*일정\s*패키지|전\s*일정\s*패키지\s*전용/i

function splitLines(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function stripLitePublicIeNoise(lines: string[]): string[] {
  return lines.filter((l) => {
    const t = l.trim()
    if (!t) return false
    if (STORED_IE_LABEL_HEADER_ONLY.test(t)) return false
    if (STANDALONE_DROP_FROM_PUBLIC_IE_TABS.test(t)) return false
    return true
  })
}

function dropStandaloneNoiseFromIeLines(lines: string[]): string[] {
  return lines.filter((l) => !STANDALONE_DROP_FROM_PUBLIC_IE_TABS.test(l.replace(/\s+/g, ' ').trim()))
}

/** 금액 토큰(원) */
function extractWonAmount(line: string): number | null {
  const m = line.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/)
  if (!m) return null
  const n = parseInt(m[1].replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/** 1인실/객실1인 계열 중복 줄인지(대표 한 줄만 남길 때 제거 대상) */
function isSingleRoomDuplicateNoiseLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/객실\s*1인\s*사용료|1인실\s*객실\s*추가요금|싱글\s*차지|독실\s*사용|1인\s*객실/i.test(t)) return true
  if (/1인\s*객실\s*사용\s*시.*추가요금|추가요금\s*발생|1인실.*별도|1인\s*실\s*추가요금/i.test(t)) return true
  return false
}

function formatCanonicalSingleRoomLine(amount: number): string {
  return `객실 1인 사용료 : ${amount.toLocaleString('ko-KR')}원`
}

/**
 * 불포함 줄 목록에서 1인실·객실1인 사용료 중복을 `객실 1인 사용료 : N원` 한 줄로 정규화.
 * 금액이 있는 줄이 있으면 그 금액(최대)으로 한 줄만 남기고, 무금액 중복 설명은 제거.
 */
export function dedupeSingleRoomSurchargeLines(lines: string[]): string[] {
  const norm = lines.map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  if (!norm.length) return []

  const roomIdx: number[] = []
  norm.forEach((l, i) => {
    if (isSingleRoomDuplicateNoiseLine(l)) roomIdx.push(i)
  })
  if (roomIdx.length === 0) return norm

  let bestAmt = -1
  for (const i of roomIdx) {
    const a = extractWonAmount(norm[i]!)
    if (a != null && a > bestAmt) bestAmt = a
  }
  const canonical = bestAmt > 0 ? formatCanonicalSingleRoomLine(bestAmt) : null

  const out: string[] = []
  for (let i = 0; i < norm.length; i++) {
    if (roomIdx.includes(i)) continue
    out.push(norm[i]!)
  }
  if (canonical) {
    const hasCanon = out.some((l) => /객실\s*1인\s*사용료\s*[:：]/.test(l))
    if (!hasCanon) out.push(canonical)
  } else {
    const firstPlain = roomIdx.map((i) => norm[i]!).find((l) => extractWonAmount(l) == null)
    if (firstPlain) out.push(firstPlain)
  }
  return out
}

export type PublicIncludedExcludedSplit = {
  includedLines: string[]
  excludedLines: string[]
  /** 포함 카드 하단에 둘 긴 주의문(포함 항목 리스트와 분리) */
  includedFootnotes: string[]
}

/**
 * 포함/불포함 원문을 헤더 기준으로 나누고, 포함 쪽에 섞인 불포함 성격 문장을 제거·이동한다.
 * 헤더 줄 자체는 결과에 넣지 않는다.
 */
export function splitIncludedExcludedForPublicDisplay(
  includedText: string | null | undefined,
  excludedText: string | null | undefined
): PublicIncludedExcludedSplit {
  const incRaw = includedText?.trim() ?? ''
  const excRaw = excludedText?.trim() ?? ''
  const includedFootnotes: string[] = []

  const incLines = splitLines(incRaw)
  const excLines = splitLines(excRaw)

  const hasLegacyIncludeExcludeSectionHeaders =
    incLines.some((l) => HEADER_INCLUDED.test(l) || HEADER_EXCLUDED.test(l)) ||
    excLines.some((l) => HEADER_INCLUDED.test(l) || HEADER_EXCLUDED.test(l))

  if (!hasLegacyIncludeExcludeSectionHeaders) {
    const incOut = stripLitePublicIeNoise(incLines)
    const excOut = stripLitePublicIeNoise(excLines)
    return {
      includedLines: incOut,
      excludedLines: dedupeSingleRoomSurchargeLines(excOut),
      includedFootnotes: [],
    }
  }

  const outInc: string[] = []
  const outExc: string[] = [...excLines]

  type Mode = 'before' | 'included' | 'excluded'
  let mode: Mode = 'before'

  const flushMisplacedFromIncluded = (line: string) => {
    const t = line.replace(/\s+/g, ' ').trim()
    if (!t) return
    if (STORED_IE_LABEL_HEADER_ONLY.test(t)) return
    if (STANDALONE_DROP_FROM_PUBLIC_IE_TABS.test(t)) return
    if (/^▷\s*호텔\s*써차지/i.test(t)) {
      outExc.push(t)
      return
    }
    if (HEADER_INCLUDED.test(t) || HEADER_EXCLUDED.test(t)) return
    if (LINE_BELONGS_EXCLUDED_NOT_INCLUDED.test(t)) {
      outExc.push(t)
      return
    }
    if (t.length >= 80 && /(?:주의|안내|참고|불포함|별도\s*지불|미포함)/i.test(t)) {
      includedFootnotes.push(t)
      return
    }
    outInc.push(t)
  }

  for (const line of incLines) {
    const t = line.trim()
    if (HEADER_INCLUDED.test(t)) {
      mode = 'included'
      continue
    }
    if (HEADER_EXCLUDED.test(t)) {
      mode = 'excluded'
      continue
    }
    if (mode === 'excluded') {
      outExc.push(t)
    } else if (mode === 'included' || mode === 'before') {
      flushMisplacedFromIncluded(t)
    }
  }

  const cleanedInc: string[] = []
  for (const line of outInc) {
    if (LINE_BELONGS_EXCLUDED_NOT_INCLUDED.test(line)) {
      if (!outExc.includes(line)) outExc.push(line)
    } else {
      cleanedInc.push(line)
    }
  }

  return {
    includedLines: dropStandaloneNoiseFromIeLines(cleanedInc),
    excludedLines: dedupeSingleRoomSurchargeLines(dropStandaloneNoiseFromIeLines(outExc)),
    includedFootnotes,
  }
}

/** mergeExcluded 이후 문자열에 대해 1인실 줄만 정리 */
export function formatPublicExcludedTextAfterMerge(mergedExcluded: string): string {
  const lines = splitLines(mergedExcluded)
  return dedupeSingleRoomSurchargeLines(lines).join('\n')
}
