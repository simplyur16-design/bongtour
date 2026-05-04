/**
 * 롯데관광(lottetour) 경로용 — 일차별 예정호텔(1일차 예정호텔 …) 구조. 상세 호텔정보 탭 SSOT.
 * DB 필드명은 Prisma와 무관하게 rawMeta.structuredSignals + 서버 병합으로 전달.
 */

export const LOTTETOUR_HOTEL_UNDECIDED_PLACEHOLDER =
  '현재 숙박시설은 미정입니다. 출발 전 안내됩니다.'

const LOTTETOUR_REVIEW_OR_PROSE_LIKE =
  /가이드|리뷰|솔직히|덕분에|만족|감동|추억|여행객|너무\s*감사|행복한\s*시간|친절|응대|이용하고\s*싶/i

export type DayHotelPlan = {
  dayIndex: number
  label: string
  hotels: string[]
  raw?: string
}

function dedupeSort(plans: DayHotelPlan[]): DayHotelPlan[] {
  const byDay = new Map<number, DayHotelPlan>()
  for (const p of plans) {
    if (!Number.isFinite(p.dayIndex) || p.dayIndex < 1) continue
    const prev = byDay.get(p.dayIndex)
    if (!prev || (p.hotels?.length ?? 0) > (prev.hotels?.length ?? 0)) {
      byDay.set(p.dayIndex, p)
    }
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, v]) => v)
}

export function normalizeDayHotelPlansFromUnknown(raw: unknown): DayHotelPlan[] {
  if (!Array.isArray(raw)) return []
  const out: DayHotelPlan[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const dayIndex = Number(o.dayIndex)
    if (!Number.isFinite(dayIndex) || dayIndex < 1) continue
    const label = typeof o.label === 'string' && o.label.trim() ? o.label.trim() : `${dayIndex}일차 예정호텔`
    let hotels: string[] = []
    if (Array.isArray(o.hotels)) {
      hotels = o.hotels.map((x) => String(x).trim()).filter(Boolean)
    } else if (typeof o.hotels === 'string' && o.hotels.trim()) {
      hotels = splitHotelNamesLine(o.hotels)
    }
    const rawLine = typeof o.raw === 'string' && o.raw.trim() ? o.raw.trim() : undefined
    if (hotels.length === 0 && rawLine) hotels = splitHotelNamesLine(rawLine)
    if (hotels.length === 0 && !rawLine) continue
    out.push({ dayIndex, label, hotels: hotels.length ? hotels : rawLine ? [rawLine] : [], raw: rawLine })
  }
  return dedupeSort(out)
}

/** 쉼표·슬래시·「또는」 등으로 호텔 후보 분리 */
/** 일정/슬롯 한 줄이 “호텔 미정” 안내 수준인지(실제 숙소명 없음). */
export function lottetourHotelLineLooksUndecidedOnly(line: string): boolean {
  const t = line.replace(/\r/g, '').trim()
  if (!t) return true
  if (LOTTETOUR_REVIEW_OR_PROSE_LIKE.test(t) && t.length > 40) return false
  if (/^※/.test(t) && t.length < 200) return true
  if (/미정|미\s*정|숙박.*미정|호텔.*미정|출발\s*\d+\s*일\s*전|홈페이지.*알려|문자로\s*안내/i.test(t)) {
    if (t.length > 220) return false
    return true
  }
  return /^[\-–—]\s*미정\s*$/i.test(t) || /^미정\s*$/i.test(t)
}

/** 일차별 일정 텍스트 전체가 위 안내만 담은 경우(실제 호텔명 없음). */
export function lottetourHotelTextBlockIsUndecidedOnly(text: string | null | undefined): boolean {
  if (!text?.trim()) return false
  const lines = text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  if (!lines.length) return false
  return lines.every((l) => lottetourHotelLineLooksUndecidedOnly(l))
}

/** 일정표의 매일 hotelText가 모두 “미정” 수준이면 본문에서 호텔 블록을 억지로 파싱하지 않는다. */
export function lottetourScheduleHotelsAreAllUndecided(
  schedule: Array<{ day: number; hotelText?: string | null }> | null | undefined
): boolean {
  if (!schedule?.length) return false
  for (const s of schedule) {
    const ht = (s.hotelText ?? '').trim()
    if (!ht) return false
    if (!lottetourHotelTextBlockIsUndecidedOnly(ht)) return false
  }
  return true
}

/** 리뷰·장문 본문이 호텔 플랜으로 잘못 들어온 경우 걸러낸다. */
export function lottetourDayHotelPlansLookLikeRealHotels(plans: DayHotelPlan[]): boolean {
  if (!plans.length) return false
  let sawReal = false
  for (const p of plans) {
    for (const h of p.hotels ?? []) {
      const t = h.trim()
      if (!t) continue
      if (t.length > 200) return false
      if (LOTTETOUR_REVIEW_OR_PROSE_LIKE.test(t)) return false
      if (lottetourHotelLineLooksUndecidedOnly(t)) continue
      if (t.length >= 2 && t.length <= 120) sawReal = true
    }
    const raw = (p.raw ?? '').trim()
    if (raw.length > 200 && LOTTETOUR_REVIEW_OR_PROSE_LIKE.test(raw)) return false
  }
  return sawReal
}

export function lottetourPlaceholderDayHotelPlans(): DayHotelPlan[] {
  return [{ dayIndex: 1, label: '숙박 안내', hotels: [LOTTETOUR_HOTEL_UNDECIDED_PLACEHOLDER] }]
}

export function splitHotelNamesLine(text: string): string[] {
  const t = text.replace(/\r/g, '').trim()
  if (!t) return []
  const normalized = t
    .split(/\n+/)
    .map((line) => line.replace(/^[•·○◎▪\-\*＊]\s*/, '').trim())
    .filter(Boolean)
  if (normalized.length > 1 && !/[\/／·,]|또는/.test(t)) {
    return normalized
  }
  const pieces = t
    .split(/\s*(?:[\/／·]|,|，|(?:\s또는\s)|(?:\s및\s))\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  return pieces.length ? pieces : [t]
}

/**
 * 본문에서 `N일차 예정호텔` 헤더 기준으로 블록을 나눈다.
 * 헤더 다음 줄들은 다음 헤더·빈 줄(연속)·문서 끝까지를 같은 일차로 본다.
 */
export function parseDayHotelPlansFromSupplierText(text: string | null | undefined): DayHotelPlan[] {
  if (!text?.trim()) return []
  const lines = text.replace(/\r/g, '').split('\n')
  const out: DayHotelPlan[] = []
  let i = 0

  const isHeader = (s: string): { day: number; inlineRest: string } | null => {
    const t = s.trim()
    let m = t.match(/^(\d+)\s*일\s*차\s*(?:예정)?\s*호텔\s*[:：]?\s*(.*)$/i)
    if (m) return { day: parseInt(m[1], 10), inlineRest: (m[2] ?? '').trim() }
    m = t.match(/^제\s*(\d+)\s*일\s*(?:차)?\s*(?:예정)?\s*호텔\s*[:：]?\s*(.*)$/i)
    if (m) return { day: parseInt(m[1], 10), inlineRest: (m[2] ?? '').trim() }
    m = t.match(/^(\d+)\s*일\s*(?:예정)?\s*호텔\s*[:：]?\s*(.*)$/i)
    if (m) return { day: parseInt(m[1], 10), inlineRest: (m[2] ?? '').trim() }
    return null
  }

  const isNextHeaderLine = (s: string) => isHeader(s) != null

  while (i < lines.length) {
    const line = lines[i]
    const head = isHeader(line)
    if (!head) {
      i++
      continue
    }
    const dayIndex = head.day
    if (dayIndex < 1) {
      i++
      continue
    }
    const chunk: string[] = []
    if (head.inlineRest) chunk.push(head.inlineRest)
    i++
    while (i < lines.length) {
      const L = lines[i]
      const trimmed = L.trim()
      if (isNextHeaderLine(L)) break
      if (!trimmed) {
        i++
        if (chunk.length > 0) {
          let j = i
          while (j < lines.length && !lines[j].trim()) j++
          if (j < lines.length && isNextHeaderLine(lines[j])) break
        }
        continue
      }
      chunk.push(trimmed)
      i++
    }
    const body = chunk.join('\n').trim()
    const hotels = splitHotelNamesLine(body)
    const label = `${dayIndex}일차 예정호텔`
    if (hotels.length > 0 || body) {
      out.push({
        dayIndex,
        label,
        hotels: hotels.length ? hotels : body ? [body] : [],
        raw: body || undefined,
      })
    }
  }

  return dedupeSort(out)
}

export function dayHotelPlansFromSchedule(
  schedule: Array<{ day: number; hotelText?: string | null }> | null | undefined
): DayHotelPlan[] {
  if (!schedule?.length) return []
  const out: DayHotelPlan[] = []
  for (const s of schedule) {
    const ht = s.hotelText?.trim()
    if (!ht) continue
    if (lottetourHotelTextBlockIsUndecidedOnly(ht)) continue
    const hotels = splitHotelNamesLine(ht)
    out.push({
      dayIndex: s.day,
      label: `${s.day}일차 예정호텔`,
      hotels: hotels.length ? hotels : [ht],
      raw: ht,
    })
  }
  return dedupeSort(out)
}

/** 공개 상세: structured → 일정 hotelText → 본문 정규식 */
export function resolveDayHotelPlansForPublic(
  structuredPlans: DayHotelPlan[] | null | undefined,
  hotelInfoRaw: string | null | undefined,
  hotelSummaryRaw: string | null | undefined,
  schedule: Array<{ day: number; hotelText?: string | null }> | null | undefined
): DayHotelPlan[] {
  const schedAllUndecided = lottetourScheduleHotelsAreAllUndecided(schedule)

  const fromStruct = normalizeDayHotelPlansFromUnknown(structuredPlans ?? [])
  if (fromStruct.length) {
    if (lottetourDayHotelPlansLookLikeRealHotels(fromStruct)) return fromStruct
    if (!schedAllUndecided) return fromStruct
  }

  const fromSched = dayHotelPlansFromSchedule(schedule)
  if (fromSched.length) return fromSched

  if (schedAllUndecided) return lottetourPlaceholderDayHotelPlans()

  const blob = [hotelInfoRaw, hotelSummaryRaw].filter((x) => x?.trim()).join('\n\n')
  const parsed = parseDayHotelPlansFromSupplierText(blob)
  if (parsed.length && lottetourDayHotelPlansLookLikeRealHotels(parsed)) return parsed
  return []
}

/** 등록 파싱: LLM 배열 우선, 없으면 일정, 없으면 본문 파서 */
export function mergeDayHotelPlansForRegister(
  llm: unknown,
  schedule: Array<{ day: number; hotelText?: string | null }> | undefined,
  hotelInfoRaw: string | null | undefined,
  pastedHotel: string | null | undefined
): DayHotelPlan[] {
  const schedAllUndecided = lottetourScheduleHotelsAreAllUndecided(schedule)

  const fromLlm = normalizeDayHotelPlansFromUnknown(llm)
  if (fromLlm.length) {
    if (lottetourDayHotelPlansLookLikeRealHotels(fromLlm)) return fromLlm
    if (!schedAllUndecided) return fromLlm
  }

  const fromSched = dayHotelPlansFromSchedule(schedule)
  if (fromSched.length) return fromSched

  if (schedAllUndecided) return lottetourPlaceholderDayHotelPlans()

  const blob = [pastedHotel, hotelInfoRaw].filter((x) => x?.trim()).join('\n\n')
  const parsed = parseDayHotelPlansFromSupplierText(blob)
  if (parsed.length && lottetourDayHotelPlansLookLikeRealHotels(parsed)) return parsed
  return []
}
