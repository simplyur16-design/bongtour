/**
 * 공급사 본문에서 최소출발·현재예약·출발확정 추출 (등록 파싱·히어로 메타 공통).
 */
export type MinimumDepartureFieldIssue = {
  field: string
  reason: string
  source: 'auto'
  severity: 'warn'
}

export type MinimumDepartureExtractResult = {
  minimumDepartureCount: number | null
  minimumDepartureText: string | null
  isDepartureGuaranteed: boolean
  currentBookedCount: number | null
  /** 예: `좌석 : 4석` — 출발 조건 한 줄 표시용 */
  remainingSeatsCount: number | null
  departureStatusText: string | null
  fieldIssues: MinimumDepartureFieldIssue[]
}

function numOrParse(s: string | undefined): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** DB·rawMeta 필드로 사용자 한 줄 (departureStatusText 우선) */
export function formatDepartureConditionForProduct(p: {
  departureStatusText?: string | null
  minimumDepartureCount?: number | null
  minimumDepartureText?: string | null
  isDepartureGuaranteed?: boolean | null
  currentBookedCount?: number | null
}): string | null {
  if (p.departureStatusText?.trim()) return p.departureStatusText.trim()
  return buildDepartureStatusDisplay({
    isDepartureGuaranteed: p.isDepartureGuaranteed === true,
    minimumDepartureCount: p.minimumDepartureCount ?? null,
    currentBookedCount: p.currentBookedCount ?? null,
    minimumDepartureText: p.minimumDepartureText?.trim() || null,
  })
}

/** 사용자·관리자 미리보기 공통 한 줄 (짧게) */
export function buildDepartureStatusDisplay(p: {
  isDepartureGuaranteed: boolean
  minimumDepartureCount: number | null
  currentBookedCount: number | null
  minimumDepartureText?: string | null
  remainingSeatsCount?: number | null
}): string | null {
  const parts: string[] = []
  if (p.isDepartureGuaranteed) parts.push('출발확정')
  if (p.minimumDepartureCount != null) parts.push(`최소출발 ${p.minimumDepartureCount}명`)
  else if (p.minimumDepartureText?.trim()) parts.push(p.minimumDepartureText.trim())
  if (p.currentBookedCount != null) parts.push(`현재예약 ${p.currentBookedCount}명`)
  if (p.remainingSeatsCount != null) parts.push(`잔여 ${p.remainingSeatsCount}석`)
  if (!parts.length) return null
  return parts.slice(0, 4).join(' · ')
}

/**
 * 복붙 본문·포함/불포합 등 통합 텍스트에서 휴리스틱 추출.
 */
export function extractMinimumDepartureMeta(fullText: string): MinimumDepartureExtractResult {
  const fieldIssues: MinimumDepartureFieldIssue[] = []
  const t = fullText.replace(/\r/g, '\n')
  if (!t.trim()) {
    return {
      minimumDepartureCount: null,
      minimumDepartureText: null,
      isDepartureGuaranteed: false,
      currentBookedCount: null,
      remainingSeatsCount: null,
      departureStatusText: null,
      fieldIssues,
    }
  }

  const flat = t.replace(/\s+/g, ' ')

  const isDepartureGuaranteed =
    /출발\s*확정|행사\s*확정|출발\s*확정\s*됨|출발확정|출발\s*확정\s*안내/i.test(flat) &&
    !/출발\s*미\s*확정|미\s*확정\s*출발|출발\s*불\s*확정/i.test(flat)

  let minimumDepartureCount: number | null = null
  let currentBookedCount: number | null = null
  let remainingSeatsCount: number | null = null

  /** 하나투어 등: `예약현황 예약 : 0명 좌석 : 4석 (최소출발 : 성인15명)` 한 줄 복합 */
  const compositeHanatour = flat.match(
    /예약현황\s+예약\s*[:：]\s*(\d+)\s*명\s+좌석\s*[:：]\s*(\d+)\s*석(?:\s*\(\s*최소출발\s*[:：]\s*성인\s*(\d+)\s*명\s*\))?/i
  )
  if (compositeHanatour) {
    currentBookedCount = numOrParse(compositeHanatour[1])
    remainingSeatsCount = numOrParse(compositeHanatour[2])
    const minC = numOrParse(compositeHanatour[3])
    if (minC != null) minimumDepartureCount = minC
  }

  const minPatterns: RegExp[] = [
    /최소출발\s*[:：]\s*성인\s*(\d+)\s*명/i,
    /\(최소출발\s*[:：]\s*성인\s*(\d+)\s*명\s*\)/i,
    /(?:최소\s*출발\s*인원|최소출발인원|행사\s*최소\s*인원|행사최소인원|최소\s*출발|최소출발)\s*[:\s/·|]*\s*(\d+)\s*명/i,
    /최소\s*(\d+)\s*명(?:\s*부터)?\s*출발/i,
    /(\d+)\s*명\s*이상(?:\s*시)?\s*출발/i,
    /(\d+)\s*명\s*부터\s*출발/i,
    /(?:출발\s*인원|출발인원)\s*[:\s/·|]*\s*(?:최소\s*)?(\d+)\s*명/i,
  ]
  if (minimumDepartureCount == null) {
    for (const re of minPatterns) {
      const m = flat.match(re)
      const n = numOrParse(m?.[1])
      if (n != null) {
        minimumDepartureCount = n
        break
      }
    }
  }

  const bookPatterns: RegExp[] = [
    /(?:현재\s*예약|예약\s*현황|현재\s*예약\s*인원|예약현황)\s+예약\s*[:：]\s*(\d+)\s*명/i,
    /(?:현재\s*예약|예약\s*현황|현재\s*예약\s*인원|예약현황)\s*[:\s/·|]*\s*(\d+)\s*명/i,
    /현재\s*(\d+)\s*명\s*(?:예약|신청)/i,
    /(?<!좌석\s*[:：]\s*)\b예약\s*[:：]\s*(\d+)\s*명/i,
    /(?:모집|접수)\s*(\d+)\s*명/i,
  ]
  if (currentBookedCount == null) {
    for (const re of bookPatterns) {
      const m = flat.match(re)
      const n = numOrParse(m?.[1])
      if (n != null) {
        currentBookedCount = n
        break
      }
    }
  }

  if (remainingSeatsCount == null) {
    const seatM = flat.match(/좌석\s*[:：]\s*(\d+)\s*석/i)
    const sn = numOrParse(seatM?.[1])
    if (sn != null) remainingSeatsCount = sn
  }

  const minimumDepartureText =
    minimumDepartureCount != null ? `최소출발 ${minimumDepartureCount}명` : null

  const departureStatusText = buildDepartureStatusDisplay({
    isDepartureGuaranteed,
    minimumDepartureCount,
    currentBookedCount,
    minimumDepartureText,
    remainingSeatsCount,
  })

  const hasMinCue =
    /최소\s*출발|최소출발|행사\s*최소|최소출발인원|행사최소인원|최소\s*\d+\s*명\s*부터|명\s*이상\s*시\s*출발|최소출발\s*[:：]\s*성인/i.test(
      flat
    )
  if (hasMinCue && minimumDepartureCount == null) {
    fieldIssues.push({
      field: 'minimumDepartureCount',
      reason: '본문에 최소출발 관련 문구는 있으나 숫자 구조화 실패',
      source: 'auto',
      severity: 'warn',
    })
  }

  const hasBookCue = /현재\s*예약|예약\s*현황|예약현황/i.test(flat)
  if (hasBookCue && currentBookedCount == null && !/예약\s*가능|예약\s*문의|예약\s*접수\s*중(?!\s*\d)/i.test(flat)) {
    fieldIssues.push({
      field: 'currentBookedCount',
      reason: '본문에 현재예약·예약현황 문구는 있으나 인원 숫자 구조화 실패',
      source: 'auto',
      severity: 'warn',
    })
  }

  return {
    minimumDepartureCount,
    minimumDepartureText,
    isDepartureGuaranteed,
    currentBookedCount,
    remainingSeatsCount,
    departureStatusText,
    fieldIssues,
  }
}
