/**
 * 국외연수 상세일정 저장 형식.
 * - raw: 운영자가 붙여넣은 본문 그대로 표시 (축약 없음)
 * - days: 레거시 JSON 일차 배열 (달력 연동용)
 */

export type TrainingScheduleDayRow = {
  day: number
  title?: string
  description: string
}

export type TrainingScheduleStorage =
  | { mode: 'raw'; text: string }
  | { mode: 'days'; days: TrainingScheduleDayRow[] }

export function serializeTrainingScheduleRaw(text: string): string {
  return JSON.stringify({ mode: 'raw', text: text.replace(/\r\n/g, '\n') })
}

export function serializeTrainingScheduleDays(days: TrainingScheduleDayRow[]): string {
  return JSON.stringify({ mode: 'days', days })
}

export function parseTrainingScheduleFromProduct(schedule: string | null | undefined): TrainingScheduleStorage {
  const raw = schedule?.trim()
  if (!raw) return { mode: 'raw', text: '' }

  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const o = parsed as Record<string, unknown>
      if (o.mode === 'raw' && typeof o.text === 'string') {
        return { mode: 'raw', text: o.text }
      }
      if (o.mode === 'days' && Array.isArray(o.days)) {
        const days: TrainingScheduleDayRow[] = []
        for (const entry of o.days) {
          if (!entry || typeof entry !== 'object') continue
          const rec = entry as Record<string, unknown>
          const day = Number(rec.day)
          const description = String(rec.description ?? '').trim()
          if (!Number.isFinite(day) || day < 1 || !description) continue
          days.push({
            day,
            title: typeof rec.title === 'string' ? rec.title.trim() : undefined,
            description,
          })
        }
        if (days.length > 0) return { mode: 'days', days }
      }
    }
    if (Array.isArray(parsed)) {
      const days: TrainingScheduleDayRow[] = []
      for (const entry of parsed) {
        if (!entry || typeof entry !== 'object') continue
        const rec = entry as Record<string, unknown>
        const day = Number(rec.day)
        const description = String(rec.description ?? rec.title ?? '').trim()
        if (!Number.isFinite(day) || day < 1 || !description) continue
        days.push({
          day,
          title: typeof rec.title === 'string' ? rec.title.trim() : undefined,
          description,
        })
      }
      if (days.length > 0) return { mode: 'days', days }
    }
  } catch {
    /* plain text fallback */
  }

  return { mode: 'raw', text: raw }
}

export function trainingScheduleToAdminText(storage: TrainingScheduleStorage): string {
  if (storage.mode === 'raw') return storage.text
  return storage.days
    .map((d) => {
      const head = d.title ? `${d.day}일차 — ${d.title}` : `${d.day}일차`
      return `${head}\n${d.description}`
    })
    .join('\n\n')
}

/** 표 행: 일차 헤더로 쪼개기 (없으면 본문 전체 1행) */
export type ScheduleTableRow = {
  dayLabel: string
  body: string
}

const DAY_HEADER_RE =
  /^(?:제\s*)?(\d{1,2})\s*일(?:차)?\s*[:：\-]?\s*(.*)$|^(?:DAY\s*0?(\d{1,2}))\b\s*[:：\-]?\s*(.*)$/i

export function scheduleTextToTableRows(text: string): ScheduleTableRow[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []

  const lines = normalized.split('\n')
  const rows: ScheduleTableRow[] = []
  let currentLabel = '일정'
  let buf: string[] = []

  const flush = () => {
    const body = buf.join('\n').trim()
    if (body) rows.push({ dayLabel: currentLabel, body })
    buf = []
  }

  for (const line of lines) {
    const m = DAY_HEADER_RE.exec(line.trim())
    if (m) {
      flush()
      const dayNum = m[1] ?? m[2]
      const rest = (m[3] ?? m[4] ?? '').trim()
      currentLabel = rest ? `${dayNum}일차 — ${rest}` : `${dayNum}일차`
      if (rest) buf.push(rest)
      continue
    }
    if (line.trim()) buf.push(line)
  }
  flush()

  if (rows.length === 0) {
    return [{ dayLabel: '상세 일정', body: normalized }]
  }
  return rows
}

export function scheduleDaysToTableRows(days: TrainingScheduleDayRow[]): ScheduleTableRow[] {
  return days.map((d) => ({
    dayLabel: d.title ? `${d.day}일차 — ${d.title}` : `${d.day}일차`,
    body: d.description,
  }))
}

/** 윈저 상세일정 표 — 일차 헤더 */
export type ParsedScheduleDayLabel = {
  dayHeading: string
  dateHeading: string | null
}

const DATE_IN_DAY_LABEL_RE =
  /(\d{1,2}\s*월\s*\d{1,2}\s*일(?:\s*\([^)]+\))?|\d{4}[./-]\d{1,2}[./-]\d{1,2}(?:\s*\([^)]+\))?)/

export function parseScheduleDayLabel(dayLabel: string): ParsedScheduleDayLabel {
  const raw = dayLabel.trim()
  const m =
    raw.match(/^(?:제\s*)?(\d{1,2})\s*일(?:차)?\s*(?:[:：\-—]\s*)?(.*)$/i) ??
    raw.match(/^DAY\s*0?(\d{1,2})\b\s*(?:[:：\-—]\s*)?(.*)$/i)
  const dayHeading = m ? `${m[1]}일차` : raw.split(/\s*[-—]\s*/)[0]?.trim() || raw
  const tail = (m?.[2] ?? '').trim()
  if (!tail) return { dayHeading, dateHeading: null }
  const dateMatch = tail.match(DATE_IN_DAY_LABEL_RE)
  if (dateMatch) return { dayHeading, dateHeading: dateMatch[1]!.trim() }
  if (/\d{1,2}\s*월|요일\)/.test(tail)) return { dayHeading, dateHeading: tail }
  return { dayHeading, dateHeading: null }
}

export type WindsorScheduleCityBlock = {
  cities: string[]
  schedule: string
}

export type WindsorScheduleDayLayout = {
  cityBlocks: WindsorScheduleCityBlock[]
  footerHotel: string | null
  footerMeals: string | null
}

const FOOTER_HOTEL_RE = /^(?:특급\s*)?호텔|★{2,}|🏨|숙박\s*:/i
const FOOTER_MEAL_RE = /^(?:조\s*[:：]|중\s*[:：]|석\s*[:：]|식사|🍴|조식|중식|석식)/i
const FOOTER_INCLUDE_RE = /^\*포함/i

function isScheduleContentLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  if (/^\[\s*\d{1,2}\s*[:：]/.test(t)) return true
  if (/^[■*·•]/.test(t)) return true
  if (/^\d{1,2}\s*[:：]\d{2}/.test(t)) return true
  if (t.length > 52) return true
  if (/방문|이동|출발|도착|체크|관광|견학|회의|탑승|하차|미팅|식사|조식|중식|석식|공항|항공/i.test(t)) return true
  return false
}

function isCityLine(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 44) return false
  if (FOOTER_HOTEL_RE.test(t) || FOOTER_MEAL_RE.test(t) || FOOTER_INCLUDE_RE.test(t)) return false
  if (isScheduleContentLine(line)) return false
  if (!/^[\p{L}\p{N}\s()\-–—・,.']+$/u.test(t)) return false
  return true
}

function normalizeCityMatchKey(city: string): string {
  return city.replace(/\s+/g, '').toLowerCase()
}

function lineMentionsCity(line: string, city: string): boolean {
  const t = line.trim()
  const c = city.trim()
  if (!t || !c) return false
  if (t.includes(c)) return true
  const key = normalizeCityMatchKey(c)
  if (key.length >= 2 && t.replace(/\s+/g, '').toLowerCase().includes(key)) return true
  return false
}

/** 상단 도시 목록 + 본문 일정 → 도시마다 좌·우 한 줄씩 (윈저 정렬) */
function splitScheduleByCityRoute(route: string[], scheduleLines: string[]): WindsorScheduleCityBlock[] {
  if (route.length === 0) {
    return [{ cities: [], schedule: scheduleLines.join('\n').trim() }]
  }
  if (route.length === 1) {
    return [{ cities: [route[0]!], schedule: scheduleLines.join('\n').trim() }]
  }

  const starts: number[] = [0]
  for (let r = 1; r < route.length; r++) {
    const city = route[r]!
    const occurrence = route.slice(0, r + 1).filter((c) => c === city).length
    let count = 0
    let found = scheduleLines.length
    for (let i = 0; i < scheduleLines.length; i++) {
      if (lineMentionsCity(scheduleLines[i]!, city)) {
        count++
        if (count >= occurrence) {
          found = i
          break
        }
      }
    }
    const prev = starts[starts.length - 1] ?? 0
    if (found <= prev && prev < scheduleLines.length) {
      found = prev + 1
    }
    if (found <= prev) {
      found = scheduleLines.length
    }
    starts.push(found)
  }

  const blocks: WindsorScheduleCityBlock[] = []
  for (let r = 0; r < route.length; r++) {
    const start = starts[r]!
    const end = r + 1 < route.length ? starts[r + 1]! : scheduleLines.length
    if (start >= end) {
      blocks.push({ cities: [route[r]!], schedule: '' })
      continue
    }
    blocks.push({
      cities: [route[r]!],
      schedule: scheduleLines.slice(start, end).join('\n').trim(),
    })
  }

  const merged: WindsorScheduleCityBlock[] = []
  for (const block of blocks) {
    if (!block.schedule) {
      if (merged.length === 0) merged.push(block)
      continue
    }
    merged.push(block)
  }

  if (merged.length === 0) {
    return [{ cities: [route[0]!], schedule: scheduleLines.join('\n').trim() }]
  }

  if (merged.length < route.length) {
    return splitScheduleByTimeMarkers(route, scheduleLines)
  }

  return merged
}

/** 본문에 도시명이 없을 때 [05:30] 등 시간 줄을 구간 경계로 사용 */
function splitScheduleByTimeMarkers(route: string[], scheduleLines: string[]): WindsorScheduleCityBlock[] {
  const markers: number[] = []
  for (let i = 0; i < scheduleLines.length; i++) {
    if (/^\[\s*\d{1,2}\s*[:：]/.test(scheduleLines[i]!.trim())) markers.push(i)
  }

  const starts: number[] = [0]
  for (let r = 1; r < route.length; r++) {
    const pick = markers[r - 1] ?? scheduleLines.length
    const prev = starts[starts.length - 1] ?? 0
    let found = pick
    if (found <= prev && prev < scheduleLines.length) found = prev + 1
    if (found <= prev) found = scheduleLines.length
    starts.push(found)
  }

  const blocks: WindsorScheduleCityBlock[] = []
  for (let r = 0; r < route.length; r++) {
    const start = starts[r]!
    const end = r + 1 < route.length ? starts[r + 1]! : scheduleLines.length
    if (start >= end) {
      blocks.push({ cities: [route[r]!], schedule: '' })
      continue
    }
    blocks.push({
      cities: [route[r]!],
      schedule: scheduleLines.slice(start, end).join('\n').trim(),
    })
  }

  if (blocks.every((b) => !b.schedule)) {
    return [{ cities: [route[0]!], schedule: scheduleLines.join('\n').trim() }]
  }
  return blocks
}

function splitInterleavedCityBlocks(lines: string[]): WindsorScheduleCityBlock[] {
  const blocks: WindsorScheduleCityBlock[] = []
  let i = 0
  while (i < lines.length) {
    while (i < lines.length && !lines[i]!.trim()) i++
    if (i >= lines.length) break

    if (!isCityLine(lines[i]!)) {
      const buf: string[] = []
      while (i < lines.length && lines[i]!.trim() && !isCityLine(lines[i]!)) {
        buf.push(lines[i]!)
        i++
      }
      if (buf.length > 0) {
        blocks.push({ cities: [], schedule: buf.join('\n').trim() })
      }
      continue
    }

    const city = lines[i]!.trim()
    i++
    const buf: string[] = []
    while (i < lines.length && lines[i]!.trim() && !isCityLine(lines[i]!)) {
      buf.push(lines[i]!)
      i++
    }
    blocks.push({ cities: [city], schedule: buf.join('\n').trim() })
  }
  return blocks
}

/** 일차 본문 → 윈저 표(좌 도시 · 우 일정) + 하단 호텔·식사 */
export function parseWindsorScheduleDayBody(body: string): WindsorScheduleDayLayout {
  const lines = body.replace(/\r\n/g, '\n').split('\n')
  const footerHotel: string[] = []
  const footerMeals: string[] = []
  const main: string[] = []

  for (const line of lines) {
    const t = line.trim()
    if (!t) {
      main.push(line)
      continue
    }
    if (FOOTER_HOTEL_RE.test(t) || (t.includes('호텔') && t.includes('★'))) {
      footerHotel.push(t)
      continue
    }
    if (FOOTER_MEAL_RE.test(t) || FOOTER_INCLUDE_RE.test(t)) {
      footerMeals.push(t)
      continue
    }
    main.push(line)
  }

  const trimmedMain = main.join('\n').trim()
  if (!trimmedMain) {
    return {
      cityBlocks: [{ cities: [], schedule: '' }],
      footerHotel: footerHotel.join('\n') || null,
      footerMeals: footerMeals.join('\n') || null,
    }
  }

  const mainLines = trimmedMain.split('\n')
  let idx = 0
  const leadCities: string[] = []
  while (idx < mainLines.length && isCityLine(mainLines[idx]!)) {
    leadCities.push(mainLines[idx]!.trim())
    idx++
  }

  let cityBlocks: WindsorScheduleCityBlock[]
  if (leadCities.length > 0) {
    cityBlocks = splitScheduleByCityRoute(leadCities, mainLines.slice(idx))
  } else {
    cityBlocks = splitInterleavedCityBlocks(mainLines)
  }

  if (cityBlocks.length === 0) {
    cityBlocks = [{ cities: [], schedule: trimmedMain }]
  }

  return {
    cityBlocks,
    footerHotel: footerHotel.join('\n') || null,
    footerMeals: footerMeals.join('\n') || null,
  }
}
