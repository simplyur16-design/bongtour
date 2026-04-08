/**
 * 참좋은여행(verygood) 경로용 — 일차별 예정호텔(1일차 예정호텔 …) 구조. 상세 호텔정보 탭 SSOT.
 * DB 필드명은 Prisma와 무관하게 rawMeta.structuredSignals + 서버 병합으로 전달.
 */

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
  const fromStruct = normalizeDayHotelPlansFromUnknown(structuredPlans ?? [])
  if (fromStruct.length) return fromStruct
  const fromSched = dayHotelPlansFromSchedule(schedule)
  if (fromSched.length) return fromSched
  const blob = [hotelInfoRaw, hotelSummaryRaw].filter((x) => x?.trim()).join('\n\n')
  return parseDayHotelPlansFromSupplierText(blob)
}

/** 등록 파싱: LLM 배열 우선, 없으면 일정, 없으면 본문 파서 */
export function mergeDayHotelPlansForRegister(
  llm: unknown,
  schedule: Array<{ day: number; hotelText?: string | null }> | undefined,
  hotelInfoRaw: string | null | undefined,
  pastedHotel: string | null | undefined
): DayHotelPlan[] {
  const fromLlm = normalizeDayHotelPlansFromUnknown(llm)
  if (fromLlm.length) return fromLlm
  const fromSched = dayHotelPlansFromSchedule(schedule)
  if (fromSched.length) return fromSched
  const blob = [pastedHotel, hotelInfoRaw].filter((x) => x?.trim()).join('\n\n')
  return parseDayHotelPlansFromSupplierText(blob)
}
