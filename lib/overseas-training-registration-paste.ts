import { buildAutoTrainingImageSceneHint } from '@/lib/gemini-image-prompt'
import type { TrainingCategory } from '@/lib/overseas-training-taxonomy'

export type TrainingRegistrationPasteResult = {
  trainingCategory: TrainingCategory | null
  title: string | null
  originalTitle: string | null
  fixedDepartureWeekday: number | null
  durationDays: number | null
  airline: string | null
  destinationSummary: string | null
  imagePromptDraft: string | null
  warnings: string[]
}

const CATEGORY_LINE_MAP: { pattern: RegExp; category: TrainingCategory }[] = [
  { pattern: /복지|행정|경제|노사|정책연수/i, category: 'policy' },
  { pattern: /교육|학교|유치원|보육/i, category: 'education' },
  { pattern: /농|축|수산|스마트팜/i, category: 'agri' },
  { pattern: /ESG|4차|제조|서비스|정보통신/i, category: 'industry_esg' },
  { pattern: /에너지|친환경|건축|도시재생/i, category: 'energy_urban' },
  { pattern: /재난|안전|소방|방재/i, category: 'safety' },
  { pattern: /문화|관광|패션|디자인|예술/i, category: 'culture' },
]

const AIRLINE_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /대한항공|KOREAN\s*AIR|\bKE\b/i, label: '대한항공' },
  { pattern: /아시아나|ASIANA|\bOZ\b/i, label: '아시아나항공' },
]

function parseWeekdayFromYmd(ymd: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!m) return null
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  if (Number.isNaN(d.getTime())) return null
  return d.getUTCDay()
}

function extractDurationFromTitle(title: string): number | null {
  const m = /(\d{1,2})\s*일/.exec(title)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 1 ? n : null
}

function extractAirlineFromText(text: string): string | null {
  for (const { pattern, label } of AIRLINE_PATTERNS) {
    if (pattern.test(text)) return label
  }
  const m = /이용항공\s*[\s:：]*([^\n\r]+)/i.exec(text)
  if (m) {
    const raw = m[1]!.trim().split(/[,，]/)[0]!.trim()
    if (raw) return raw.slice(0, 80)
  }
  const paren = /\(([^)]*(?:항공|AIR)[^)]*)\)/i.exec(text)
  if (paren) {
    for (const { pattern, label } of AIRLINE_PATTERNS) {
      if (pattern.test(paren[1]!)) return label
    }
  }
  return null
}

function extractTitleLine(lines: string[]): string | null {
  for (const line of lines) {
    const t = line.trim()
    if (t.length < 8) continue
    if (/^\[.+]/.test(t)) return t.slice(0, 280)
    if (/연수\s*\d{1,2}\s*일/.test(t) && /\[/.test(t)) return t.slice(0, 280)
  }
  for (const line of lines) {
    const t = line.trim()
    if (t.length >= 12 && !/여행기간|이용항공|예약|담당|T\.|@/i.test(t)) {
      return t.slice(0, 280)
    }
  }
  return null
}

function extractDestinationFromTitle(title: string): string | null {
  const inner = /\[([^\]]+)\]/.exec(title)
  const chunk = inner ? inner[1]! : title
  const afterBracket = chunk.replace(/^[^\-·]+[-·]\s*/, '').trim()
  const countries = afterBracket
    .replace(/\d{1,2}\s*일.*$/i, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
  return countries ? countries.slice(0, 200) : null
}

/**
 * 윈저·협력사 상단 요약 블록(분야·상품명·여행기간·이용항공) 파싱.
 */
export function parseTrainingRegistrationPaste(pasted: string): TrainingRegistrationPasteResult {
  const warnings: string[] = []
  const lines = pasted.replace(/\r\n/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean)

  let trainingCategory: TrainingCategory | null = null
  for (const line of lines.slice(0, 5)) {
    for (const { pattern, category } of CATEGORY_LINE_MAP) {
      if (pattern.test(line)) {
        trainingCategory = category
        break
      }
    }
    if (trainingCategory) break
  }

  const title = extractTitleLine(lines)
  const durationDays = title ? extractDurationFromTitle(title) : null
  const destinationSummary = title ? extractDestinationFromTitle(title) : null

  let fixedDepartureWeekday: number | null = null
  const departLine = lines.find((l) => /한국\s*출발|출발/.test(l) && /\d{4}-\d{2}-\d{2}/.test(l))
  if (departLine) {
    const ymd = /\d{4}-\d{2}-\d{2}/.exec(departLine)?.[0]
    if (ymd) fixedDepartureWeekday = parseWeekdayFromYmd(ymd)
  }
  if (fixedDepartureWeekday == null) {
    warnings.push('출발일(한국 출발)에서 요일을 찾지 못했습니다. 기본 정보에서 출발 요일을 직접 선택하세요.')
  }

  const airline = extractAirlineFromText(pasted)
  if (!airline) warnings.push('이용항공을 찾지 못했습니다. 항공사는 수동 입력하세요.')

  const imagePromptDraft = buildAutoTrainingImageSceneHint({
    title,
    destination: destinationSummary,
    trainingCategory,
    trainingDescription: null,
  })

  if (!title) warnings.push('상품명 줄을 찾지 못했습니다. 봉투어 노출 제목을 직접 입력하세요.')

  return {
    trainingCategory,
    title,
    originalTitle: title,
    fixedDepartureWeekday,
    durationDays,
    airline,
    destinationSummary,
    imagePromptDraft,
    warnings,
  }
}
