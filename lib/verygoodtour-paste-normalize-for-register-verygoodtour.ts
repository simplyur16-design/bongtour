/**
 * 참좋은여행(verygoodtour) 관리자 붙여넣기 — 일정/날짜 추출용 전처리.
 * detail-body `normalizeDetailRawText`와 분리(필드 추출용 vs 일차 raw 보존).
 */
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { normalizeCalendarDate } from '@/lib/date-normalize'

const UI_LINE_DROP = /^(지도보기|내용\s*전체\s*열기|내용보기|바로가기|복사|URL|단축|인쇄하기|미팅장소보기)$/i

/** CRLF 통일 + 줄 단위 trim(탭은 유지). */
export function normalizeVerygoodRegisterPasteLineEndings(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * 일정 N일차 마커 탐지 전용: 연속 공백 축소·UI 잔재 줄 제거.
 * 탭으로 이어진 `O 포함사항\tO 불포함` 등은 유지.
 */
export function normalizeVerygoodPasteForScheduleExtract(raw: string): string {
  let t = normalizeVerygoodRegisterPasteLineEndings(raw)
  const lines = t.split('\n')
  const out: string[] = []
  for (let line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      out.push('')
      continue
    }
    if (UI_LINE_DROP.test(trimmed)) continue
    const squashed = trimmed.includes('\t')
      ? trimmed
          .split('\t')
          .map((c) => c.replace(/[ \u00a0]{2,}/g, ' ').trim())
          .join('\t')
      : trimmed.replace(/[ \u00a0]{2,}/g, ' ')
    out.push(squashed)
  }
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n')
}

/** 일정표 후보: 첫 `N일차` ~ 하단 마케팅 앵커 직전 */
const ITINERARY_END_ANCHORS: RegExp[] = [
  /^\s*고객상품평/,
  /^\s*고객\s*상품평\s*$/,
  /^\s*평균\s*별점\s*$/,
  /^\s*오늘의\s*날씨\s*$/,
  /^\s*현지\s*시각\s*$/,
  /^\s*상품가격\s*$/,
  /^\s*총\s*금액\b/,
  /^\s*무이자\s*할부\s*$/,
  /^\s*상품평점\s*$/,
  /^\s*여행후기\s*$/,
]

const FIRST_DAY_RE = /^\s*(\d{1,2})일차\s*$/

export function sliceVerygoodItineraryBodyForDayMarkers(raw: string): string {
  const lines = normalizeVerygoodRegisterPasteLineEndings(raw).split('\n')
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (FIRST_DAY_RE.test(lines[i]!.trim())) {
      start = i
      break
    }
  }
  if (start < 0) return raw.trim()

  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i]!.replace(/\s+/g, ' ').trim()
    if (!t) continue
    if (ITINERARY_END_ANCHORS.some((re) => re.test(t))) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n').trim()
}

export type VerygoodTripAnchorDates = {
  tripStartIso: string | null
  tripEndIso: string | null
  tripStartSource: string
  tripEndSource: string
}

function isoFromYmdDots(s: string | null | undefined): string | null {
  if (!s?.trim()) return null
  const m = s.trim().match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/)
  if (!m) return null
  const iso = normalizeCalendarDate(`${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`)
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

function isoFromKoreanLine(line: string | null | undefined): string | null {
  if (!line?.trim()) return null
  const m = line.replace(/\s+/g, ' ').trim().match(/^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/)
  if (!m) return null
  const iso = normalizeCalendarDate(`${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`)
  return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null
}

/**
 * 히어로·합성 출발일용: 출국/입국 블록 > 항공 structured > 1일차/마지막 일차 날짜 > (마지막) 여행기간 문구 보조.
 */
export function extractVerygoodTripAnchorDatesFromPasteBlob(
  blob: string,
  fs: FlightStructured | null | undefined,
  durationText: string | null | undefined,
  scheduleRows: Array<{ day: number; dateText?: string | null | undefined }>
): VerygoodTripAnchorDates {
  let tripStartIso: string | null = null
  let tripEndIso: string | null = null
  let tripStartSource = 'none'
  let tripEndSource = 'none'

  const outBlock = blob.match(/출국\s*\n\s*(\d{4}\.\d{2}\.\d{2})/)
  if (outBlock?.[1]) {
    const iso = isoFromYmdDots(outBlock[1])
    if (iso) {
      tripStartIso = iso
      tripStartSource = 'paste_out_block_first_date'
    }
  }

  const inIncheon = blob.match(/입국\s*[\s\S]*?(\d{4}\.\d{2}\.\d{2})\s*\([^)]*\)\s*\d{1,2}:\d{2}\s*인천\s*도착/s)
  if (inIncheon?.[1]) {
    const iso = isoFromYmdDots(inIncheon[1])
    if (iso) {
      tripEndIso = iso
      tripEndSource = 'paste_in_block_incheon_arrival'
    }
  }

  if (!tripStartIso && fs?.outbound?.departureDate) {
    const iso = isoFromYmdDots(fs.outbound.departureDate) || isoFromYmdDots(fs.outbound.departureDate.replace(/-/g, '.'))
    if (iso) {
      tripStartIso = iso
      tripStartSource = 'flight_structured_outbound_departureDate'
    }
  }
  if (!tripEndIso && fs?.inbound?.arrivalDate) {
    const ap = (fs.inbound.arrivalAirport ?? '').trim()
    if (!ap || /인천|서울/i.test(ap)) {
      const iso = isoFromYmdDots(fs.inbound.arrivalDate) || isoFromYmdDots(fs.inbound.arrivalDate.replace(/-/g, '.'))
      if (iso) {
        tripEndIso = iso
        tripEndSource = 'flight_structured_inbound_arrivalDate'
      }
    }
  }

  const byDay = new Map(scheduleRows.map((r) => [r.day, r]))
  const d1 = byDay.get(1)
  const maxDay = Math.max(0, ...scheduleRows.map((r) => r.day))
  const dLast = maxDay > 0 ? byDay.get(maxDay) : undefined
  if (!tripStartIso && d1?.dateText) {
    const iso = isoFromKoreanLine(d1.dateText)
    if (iso) {
      tripStartIso = iso
      tripStartSource = 'itinerary_day1_dateText'
    }
  }
  if (!tripEndIso && dLast?.dateText) {
    const iso = isoFromKoreanLine(dLast.dateText)
    if (iso) {
      tripEndIso = iso
      tripEndSource = `itinerary_day${maxDay}_dateText`
    }
  }

  if (tripStartIso && !tripEndIso) {
    const m = (durationText ?? '').match(/(\d+)\s*박\s*(\d+)\s*일/)
    if (m) {
      const days = parseInt(m[2]!, 10)
      if (days >= 2) {
        const base = tripStartIso.split('-').map(Number)
        if (base.length === 3) {
          const d = new Date(Date.UTC(base[0]!, base[1]! - 1, base[2]!))
          d.setUTCDate(d.getUTCDate() + (days - 1))
          const y = d.getUTCFullYear()
          const mo = String(d.getUTCMonth() + 1).padStart(2, '0')
          const da = String(d.getUTCDate()).padStart(2, '0')
          tripEndIso = `${y}-${mo}-${da}`
          tripEndSource = 'duration_days_minus_one_offset'
        }
      }
    }
  }

  return { tripStartIso, tripEndIso, tripStartSource, tripEndSource }
}
