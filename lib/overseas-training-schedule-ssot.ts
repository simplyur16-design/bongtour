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
