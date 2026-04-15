/**
 * 참좋은여행(verygoodtour) 본문에서 `N일차` 블록을 결정적으로 잘라 RegisterScheduleDay[]로 만든다.
 * LLM 일정 누락·보강 시 본문 N일차 블록으로 보조한다.
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { pickMergedVerygoodDayDescription } from '@/lib/verygoodtour-schedule-description-polish'
import {
  normalizeVerygoodPasteForScheduleExtract,
  sliceVerygoodItineraryBodyForDayMarkers,
} from '@/lib/verygoodtour-paste-normalize-for-register-verygoodtour'

const DAY_HEADER_RE = /^\s*(\d{1,2})일차\s*$/
const DATE_LINE_RE = /^\d{4}년\s*\d{1,2}월\s*\d{1,2}일/

/** ItineraryDay.dateText / 목록 표시용 — 한글·점 형식을 YYYY-MM-DD로 통일 */
function normalizeVerygoodDayDateText(raw: string): string {
  const s = raw.replace(/\s+/g, ' ').trim()
  const kr = s.match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
  if (kr) {
    return `${kr[1]}-${kr[2]!.padStart(2, '0')}-${kr[3]!.padStart(2, '0')}`
  }
  const dot = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (dot) {
    return `${dot[1]}-${dot[2]!.padStart(2, '0')}-${dot[3]!.padStart(2, '0')}`
  }
  return s
}

export type VerygoodScheduleBlocksExtractLog = {
  hasDay1: boolean
  hasDay2: boolean
  hasDay7: boolean
  rawDayBlockCount: number
  firstFiveLinesPerBlock: string[][]
  refinedRowCount: number
  droppedRows: Array<{ day?: number; reason: string }>
}

export type VerygoodScheduleBlocksExtractResult = {
  rows: RegisterScheduleDay[]
  log: VerygoodScheduleBlocksExtractLog
}

function shouldDropVerygoodUiLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^지도보기(\s*지도보기)*$/.test(t)) return true
  if (t === '내용 전체 열기' || t === '내용보기') return true
  return false
}

function stripNoiseFromLines(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (shouldDropVerygoodUiLine(line)) continue
    out.push(line)
  }
  return out
}

function trimLines(lines: string[]): string[] {
  return lines.map((l) => l.trim())
}

function parseMealSection(mealBlob: string): Pick<
  RegisterScheduleDay,
  'breakfastText' | 'lunchText' | 'dinnerText' | 'mealSummaryText'
> {
  const t = mealBlob.replace(/\r/g, '').trim()
  if (!t) return {}
  const triplet = t.match(
    /(?:조식|아침)\s*[-:：/／]\s*([^/|]+?)\s*[/|／]\s*(?:중식|점심)\s*[-:：]?\s*([^/|]+?)\s*[/|／]\s*(?:석식|저녁)\s*[-:：]?\s*([^/|]+)/i
  )
  if (triplet) {
    const a = triplet[1]?.trim().slice(0, 200)
    const b = triplet[2]?.trim().slice(0, 200)
    const c = triplet[3]?.trim().slice(0, 200)
    return {
      breakfastText: a || null,
      lunchText: b || null,
      dinnerText: c || null,
    }
  }
  const bp = t.match(/(?:조식|아침)\s*[-:：]\s*([^\n]+)/i)
  const lp = t.match(/(?:중식|점심)\s*[-:：]\s*([^\n]+)/i)
  const dp = t.match(/(?:석식|저녁)\s*[-:：]\s*([^\n]+)/i)
  const out: Pick<RegisterScheduleDay, 'breakfastText' | 'lunchText' | 'dinnerText' | 'mealSummaryText'> = {}
  if (bp?.[1]) out.breakfastText = bp[1].trim().slice(0, 200)
  if (lp?.[1]) out.lunchText = lp[1].trim().slice(0, 200)
  if (dp?.[1]) out.dinnerText = dp[1].trim().slice(0, 200)
  if (Object.keys(out).length) return out
  return { mealSummaryText: t.slice(0, 500) }
}

/**
 * 단일 일차 블록( `N일차` 줄 제외 )을 필드로 나눈다.
 */
function parseOneDaySegment(day: number, segmentLinesRaw: string[]): {
  row: RegisterScheduleDay | null
  dropReason?: string
} {
  const L = trimLines(stripNoiseFromLines(segmentLinesRaw)).filter((l) => l.length > 0)

  let i = 0
  let dateText: string | null = null
  if (i < L.length && DATE_LINE_RE.test(L[i])) {
    dateText = normalizeVerygoodDayDateText(L[i])
    i++
  }

  let title = ''
  if (i < L.length && L[i] !== '호텔' && L[i] !== '식사') {
    title = L[i]
    i++
  }

  const hotelIdx = L.findIndex((line, j) => j >= i && line === '호텔')
  const mealIdx = L.findIndex((line, j) => j >= i && line === '식사')

  let bodyStr = ''
  let hotelText: string | null = null
  let mealBlob = ''

  if (hotelIdx >= 0 && mealIdx > hotelIdx) {
    bodyStr = L.slice(i, hotelIdx).join('\n').trim()
    hotelText = L.slice(hotelIdx + 1, mealIdx).join('\n').trim() || null
    mealBlob = L.slice(mealIdx + 1).join('\n').trim()
  } else if (hotelIdx >= 0) {
    bodyStr = L.slice(i, hotelIdx).join('\n').trim()
    hotelText = L.slice(hotelIdx + 1).join('\n').trim() || null
  } else if (mealIdx >= 0) {
    bodyStr = L.slice(i, mealIdx).join('\n').trim()
    mealBlob = L.slice(mealIdx + 1).join('\n').trim()
  } else {
    bodyStr = L.slice(i).join('\n').trim()
  }

  const mealParsed = parseMealSection(mealBlob)

  if (!dateText && !title && !bodyStr && !hotelText && !mealBlob) {
    return { row: null, dropReason: '블록 본문이 비어 있음(UI 잔여만 있거나 구조 불일치)' }
  }

  const row: RegisterScheduleDay = {
    day,
    title: title || `Day ${day}`,
    description: bodyStr,
    /** 결정론 단계에서는 비워 두고, LLM·후처리(`polishVerygoodRegisterScheduleImageKeywords`)가 채운다. */
    imageKeyword: '',
    dateText,
    hotelText,
    ...mealParsed,
  }
  return { row }
}

/**
 * 붙여넣은 본문에서 `1일차`…`N일차` 마커로 블록을 나눠 일정 행을 만든다.
 */
export function extractVerygoodScheduleRowsFromPasteBody(text: string): VerygoodScheduleBlocksExtractResult {
  const droppedRows: Array<{ day?: number; reason: string }> = []
  if (!text?.trim()) {
    return {
      rows: [],
      log: {
        hasDay1: false,
        hasDay2: false,
        hasDay7: false,
        rawDayBlockCount: 0,
        firstFiveLinesPerBlock: [],
        refinedRowCount: 0,
        droppedRows: [{ reason: '빈 본문' }],
      },
    }
  }

  const sliced = sliceVerygoodItineraryBodyForDayMarkers(text)
  const bodyForMarkers = normalizeVerygoodPasteForScheduleExtract(sliced.length > 60 ? sliced : text)

  const allLines = bodyForMarkers.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const markers: { lineIndex: number; day: number }[] = []
  for (let i = 0; i < allLines.length; i++) {
    const m = allLines[i].match(DAY_HEADER_RE)
    if (m) {
      const day = parseInt(m[1], 10)
      if (day >= 1 && day <= 366) markers.push({ lineIndex: i, day })
    }
  }

  const hasDay1 = markers.some((x) => x.day === 1)
  const hasDay2 = markers.some((x) => x.day === 2)
  const hasDay7 = markers.some((x) => x.day === 7)

  if (markers.length === 0) {
    return {
      rows: [],
      log: {
        hasDay1,
        hasDay2,
        hasDay7,
        rawDayBlockCount: 0,
        firstFiveLinesPerBlock: [],
        refinedRowCount: 0,
        droppedRows: [{ reason: '`N일차` 마커 없음' }],
      },
    }
  }

  const rows: RegisterScheduleDay[] = []
  const firstFiveLinesPerBlock: string[][] = []

  for (let b = 0; b < markers.length; b++) {
    const start = markers[b].lineIndex + 1
    const end = b + 1 < markers.length ? markers[b + 1].lineIndex : allLines.length
    const segmentRaw = allLines.slice(start, end)
    const day = markers[b].day

    firstFiveLinesPerBlock.push(segmentRaw.slice(0, 5).map((l) => l))

    const { row, dropReason } = parseOneDaySegment(day, segmentRaw)
    if (row) {
      rows.push(row)
    } else if (dropReason) {
      droppedRows.push({ day, reason: dropReason })
    }
  }

  const log: VerygoodScheduleBlocksExtractLog = {
    hasDay1,
    hasDay2,
    hasDay7,
    rawDayBlockCount: markers.length,
    firstFiveLinesPerBlock,
    refinedRowCount: rows.length,
    droppedRows,
  }

  return { rows, log }
}

/**
 * `runScheduleExtractLlm`(공통)이 만든 일정 요약·설명에, 참좋은 `N일차` 블록 결정값(dateText·호텔·식사)을 보강한다.
 * Gemini 쪽이 비어 있을 때만 결정값으로 채운다.
 */
export function mergeVerygoodGeminiScheduleWithDeterministicBlocks(
  gemini: RegisterScheduleDay[],
  det: RegisterScheduleDay[]
): RegisterScheduleDay[] {
  const byDay = new Map(det.map((r) => [r.day, r]))
  const str = (x: string | null | undefined) => (typeof x === 'string' ? x.trim() : '')
  const pick = (g: string | null | undefined, b: string | null | undefined) => {
    const x = str(g)
    return x ? g! : str(b) ? b! : null
  }
  const maxDay = Math.max(0, ...gemini.map((r) => Number(r.day) || 0))
  return gemini.map((s) => {
    const d = byDay.get(s.day)
    if (!d) return s
    const day = Number(s.day) || 0
    const isLastDay = maxDay >= 1 && day === maxDay
    return {
      ...s,
      dateText: str(d.dateText) ? d.dateText : s.dateText,
      title: str(s.title) ? s.title : d.title,
      description: pickMergedVerygoodDayDescription(s, d, { isLastDay }),
      imageKeyword: str(s.imageKeyword) ? s.imageKeyword : d.imageKeyword,
      hotelText: pick(s.hotelText, d.hotelText),
      breakfastText: pick(s.breakfastText, d.breakfastText),
      lunchText: pick(s.lunchText, d.lunchText),
      dinnerText: pick(s.dinnerText, d.dinnerText),
      mealSummaryText: pick(s.mealSummaryText, d.mealSummaryText),
    }
  })
}
