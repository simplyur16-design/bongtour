/**
 * 교원이지(kyowontour) — 상품 본문 붙여넣기 → Gemini JSON 1회 추출 (Phase 2-A 스켈레톤).
 * orchestration / 관리자 UI / DB upsert는 후속 Phase에서 연결한다.
 *
 * 패턴 참고: `lib/register-from-llm-modetour.ts` (generateContent + responseMimeType JSON),
 * `lib/register-llm-schema-modetour.ts`(필드 분리 개념), `lib/llm-json-extract.ts`, `lib/bongtour-tone-manner-llm-ssot.ts`.
 */
import {
  BONGTOUR_TONE_MANNER_LLM_BLOCK,
  LLM_JSON_OUTPUT_DISCIPLINE_BLOCK,
  REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO,
  REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK,
} from '@/lib/bongtour-tone-manner-llm-ssot'
import { geminiTimeoutOpts, getGenAI, getModelName, GEMINI_GENERATE_TIMEOUT_MS, testGeminiConnection } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'

const SUPPLIER_KEY = 'kyowontour' as const

/** 붙여넣기 본문 상한 (4공급사 register-from-llm 계열과 동일 32k) */
export const KYOWONTOUR_REGISTER_BODY_MAX_CHARS = 32_000

/** 단일 Gemini 호출 출력 상한 (일정 포함 시 잘림 방지 — env로 상향 가능) */
const KYOWONTOUR_REGISTER_MAX_OUTPUT_TOKENS = Math.max(
  8192,
  Math.min(32_768, Number(process.env.KYOWONTOUR_REGISTER_MAX_OUTPUT_TOKENS) || 16_384)
)

// --- Types (요구 스키마 + Phase 2-B/C에서 관리자 입력과 병합 예정) ---

export type KyowontourFlightSegment = {
  departureDateTime: string
  flightNo: string
  arrivalDateTime: string
}

export type KyowontourFlightFromBody = {
  airline: string
  outbound: KyowontourFlightSegment
  inbound: KyowontourFlightSegment
}

export type KyowontourOptionalTourFromBody = {
  name: string
  description: string
  priceAdult: number
  priceChild: number
  priceInfant: number
  currency: 'USD' | 'KRW'
  duration: string
  alternativeProgram: string
}

export type KyowontourShoppingItemFromBody = {
  itemName: string
  shopLocation: string
  duration: string
  refundable: string
}

export type KyowontourScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type KyowontourScheduleDayParsed = {
  dayNumber: number
  title?: string
  activities: string[]
  hotel?: string
  meals: KyowontourScheduleMeals
}

export type KyowontourMeetingInfo = {
  location: string
  time: string
}

/** Gemini 1회 추출 결과 (관리자 항공/옵션/쇼핑 입력이 있으면 후속 Phase에서 우선 적용) */
export type KyowontourRegisterParsed = {
  productCode: string
  /** 공급사 페이지 제목·상품명 원문 그대로 (재생성·톤 변환 금지) */
  title: string
  durationLabel: string
  priceAdult: number
  /** 아동: 출발일·상품에 따라 성인가와 동일할 수 있음 — 본문 숫자 그대로 */
  priceChild: number
  /** 유아: 본문·표에 있는 유아가 그대로 */
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'

  flightFromBody?: KyowontourFlightFromBody | null
  schedule: KyowontourScheduleDayParsed[]
  meetingInfo?: KyowontourMeetingInfo | null
  hotelGradeLabel?: string

  includedItems: string[]
  /** 현지비용·1인객실료 등은 가능하면 이 배열에 넣는다 */
  excludedItems: string[]

  optionalToursFromBody?: KyowontourOptionalTourFromBody[] | null
  shoppingItemsFromBody?: KyowontourShoppingItemFromBody[] | null

  /** 감사·E2E 매칭용으로 클리핑된 원문 전체 */
  originalBodyText: string
}

export class KyowontourRegisterParseError extends Error {
  readonly code = 'KyowontourRegisterParseError' as const
  constructor(
    message: string,
    readonly details?: { rawSnippet?: string; cause?: unknown }
  ) {
    super(message)
    this.name = 'KyowontourRegisterParseError'
  }

  static is(e: unknown): e is KyowontourRegisterParseError {
    return e instanceof KyowontourRegisterParseError
  }
}

export type KyowontourRegisterGeminiResult = {
  parsed: KyowontourRegisterParsed
  rawText: string
  model: string
  finishReason: string | null
}

// --- Prompt ---

const REGISTER_KYWONTOUR_ROLE_BLOCK = `# Role: 교원이지(여행이지) 상품 본문 추출 전용
- 공급사: kyowontour (교원이지 / 여행이지 스타일 상세 HTML·텍스트 붙여넣기).
- **title 필드**: 본문에 나타난 상품명·타이틀을 **한 글자도 창작·요약·톤 변경 없이** 그대로 옮긴다. (봉투어 톤앤매너 재생성은 하지 않는다.)
- **가격**: 숫자만. 천 단위 콤마·'원'·공백은 제거해 정수로 넣는다.
- **아동/유아**: 본문·가격표에 표기된 값 그대로. 본문에 유아만 있고 아동이 성인과 동일하게 서술된 경우 성인가와 동일 숫자로 넣어도 된다.
- **포함/불포함**: 본문에 명시된 항목만 배열로 나눈다. **현지 경비·현지비용·1인 객실료·싱글차지** 등은 가능하면 excludedItems에 넣는다.
- **선택관광·쇼핑**: 본문·표에 구체 행이 있으면 배열로 추출. 없거나 불명확하면 null.
- **항공**: 본문에 편명·출발/도착 시각이 명확할 때만 flightFromBody 채움. 불명확하면 null (관리자 항공 입력이 Phase 2-G에서 우선).
`

const KYOWONTOUR_JSON_SHAPE_INSTRUCTION = `# 출력 JSON 필드 (모두 필수 키 존재, 없으면 빈 문자열·빈 배열·null 규칙 준수)
{
  "productCode": string,
  "title": string,
  "durationLabel": string,
  "priceAdult": number,
  "priceChild": number,
  "priceInfant": number,
  "fuelSurcharge": number | null,
  "currency": "KRW",
  "flightFromBody": {
    "airline": string,
    "outbound": { "departureDateTime": string, "flightNo": string, "arrivalDateTime": string },
    "inbound": { "departureDateTime": string, "flightNo": string, "arrivalDateTime": string }
  } | null,
  "schedule": [
    {
      "dayNumber": number,
      "title": string | null,
      "activities": string[],
      "hotel": string | null,
      "meals": { "breakfast": string, "lunch": string, "dinner": string }
    }
  ],
  "meetingInfo": { "location": string, "time": string } | null,
  "hotelGradeLabel": string | null,
  "includedItems": string[],
  "excludedItems": string[],
  "optionalToursFromBody": [ ... ] | null,
  "shoppingItemsFromBody": [ ... ] | null,
  "originalBodyText": string
}

optionalToursFromBody 요소:
{ "name","description","priceAdult","priceChild","priceInfant","currency":"KRW"|"USD","duration","alternativeProgram" }

shoppingItemsFromBody 요소:
{ "itemName","shopLocation","duration","refundable" }
`

function buildKyowontourRegisterPrompt(clippedBody: string): string {
  return [
    REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO.trim(),
    REGISTER_KYWONTOUR_ROLE_BLOCK.trim(),
    BONGTOUR_TONE_MANNER_LLM_BLOCK.trim(),
    LLM_JSON_OUTPUT_DISCIPLINE_BLOCK.trim(),
    REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK.trim(),
    KYOWONTOUR_JSON_SHAPE_INSTRUCTION.trim(),
    '',
    '--- SUPPLIER_BODY_START ---',
    clippedBody,
    '--- SUPPLIER_BODY_END ---',
  ].join('\n\n')
}

/** 붙여넣기 전처리: 개행 정규화 + 길이 클리핑 */
export function clipKyowontourRegisterBodyText(text: string, maxChars: number = KYOWONTOUR_REGISTER_BODY_MAX_CHARS): string {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (normalized.length <= maxChars) return normalized
  return normalized.slice(0, maxChars)
}

function asString(v: unknown, fallback = ''): string {
  if (v === null || v === undefined) return fallback
  if (typeof v === 'string') return v
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return fallback
}

function asFiniteNumber(v: unknown, field: string): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[,원\s]/g, ''))
    if (Number.isFinite(n)) return n
  }
  throw new KyowontourRegisterParseError(`invalid number: ${field}`)
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => asString(x).trim()).filter(Boolean)
}

function parseMeals(v: unknown): KyowontourScheduleMeals {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { breakfast: '', lunch: '', dinner: '' }
  }
  const o = v as Record<string, unknown>
  return {
    breakfast: asString(o.breakfast),
    lunch: asString(o.lunch),
    dinner: asString(o.dinner),
  }
}

function parseFlightSegment(v: unknown): KyowontourFlightSegment {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { departureDateTime: '', flightNo: '', arrivalDateTime: '' }
  }
  const o = v as Record<string, unknown>
  return {
    departureDateTime: asString(o.departureDateTime),
    flightNo: asString(o.flightNo),
    arrivalDateTime: asString(o.arrivalDateTime),
  }
}

function parseFlightFromBody(v: unknown): KyowontourFlightFromBody | null {
  if (v === null || v === undefined) return null
  if (typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const airline = asString(o.airline).trim()
  if (!airline) return null
  const outbound = parseFlightSegment(o.outbound)
  const inbound = parseFlightSegment(o.inbound)
  if (!outbound.flightNo.trim() || !inbound.flightNo.trim()) return null
  return { airline, outbound, inbound }
}

function parseOptionalTours(v: unknown): KyowontourOptionalTourFromBody[] | null {
  if (v === null || v === undefined) return null
  if (!Array.isArray(v)) return null
  if (v.length === 0) return null
  const out: KyowontourOptionalTourFromBody[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const currency = asString(r.currency).toUpperCase() === 'USD' ? 'USD' : 'KRW'
    out.push({
      name: asString(r.name),
      description: asString(r.description),
      priceAdult: asFiniteNumber(r.priceAdult, 'optionalTour.priceAdult'),
      priceChild: asFiniteNumber(r.priceChild, 'optionalTour.priceChild'),
      priceInfant: asFiniteNumber(r.priceInfant, 'optionalTour.priceInfant'),
      currency,
      duration: asString(r.duration),
      alternativeProgram: asString(r.alternativeProgram),
    })
  }
  return out.length ? out : null
}

function parseShopping(v: unknown): KyowontourShoppingItemFromBody[] | null {
  if (v === null || v === undefined) return null
  if (!Array.isArray(v)) return null
  if (v.length === 0) return null
  const out: KyowontourShoppingItemFromBody[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    out.push({
      itemName: asString(r.itemName),
      shopLocation: asString(r.shopLocation),
      duration: asString(r.duration),
      refundable: asString(r.refundable),
    })
  }
  return out.length ? out : null
}

function parseMeeting(v: unknown): KyowontourMeetingInfo | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const location = asString(o.location).trim()
  const time = asString(o.time).trim()
  if (!location && !time) return null
  return { location, time }
}

function parseScheduleDays(v: unknown): KyowontourScheduleDayParsed[] {
  if (!Array.isArray(v)) return []
  const days: KyowontourScheduleDayParsed[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const dayNumber = asFiniteNumber(r.dayNumber, 'schedule.dayNumber')
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 99) {
      throw new KyowontourRegisterParseError('schedule.dayNumber must be integer 1..99')
    }
    const activities = asStringArray(r.activities)
    days.push({
      dayNumber,
      title: asString(r.title).trim() || undefined,
      activities,
      hotel: asString(r.hotel).trim() || undefined,
      meals: parseMeals(r.meals),
    })
  }
  days.sort((a, b) => a.dayNumber - b.dayNumber)
  return days
}

/**
 * Gemini 원문 텍스트(JSON) → `KyowontourRegisterParsed`.
 * `originalBodyText`는 호출부에서 클리핑된 본문을 주입한다.
 */
export function parseKyowontourRegisterGeminiResponse(
  llmText: string,
  clippedOriginalBody: string
): KyowontourRegisterParsed {
  const raw = parseLlmJsonObject<Record<string, unknown>>(llmText, { logLabel: 'kyowontour-register-llm' })

  const productCode = asString(raw.productCode).trim()
  const title = asString(raw.title).trim()
  if (!productCode) throw new KyowontourRegisterParseError('missing productCode')
  if (!title) throw new KyowontourRegisterParseError('missing title')

  const currency: 'KRW' = 'KRW'
  const durationLabel = asString(raw.durationLabel).trim()
  if (!durationLabel) throw new KyowontourRegisterParseError('missing durationLabel')

  const priceAdult = asFiniteNumber(raw.priceAdult, 'priceAdult')
  const priceChild = asFiniteNumber(raw.priceChild, 'priceChild')
  const priceInfant = asFiniteNumber(raw.priceInfant, 'priceInfant')
  if (priceAdult < 0 || priceChild < 0 || priceInfant < 0) {
    throw new KyowontourRegisterParseError('prices must be non-negative')
  }

  let fuel: number | undefined
  if (raw.fuelSurcharge !== null && raw.fuelSurcharge !== undefined && String(raw.fuelSurcharge).trim() !== '') {
    const f = asFiniteNumber(raw.fuelSurcharge, 'fuelSurcharge')
    if (f >= 0) fuel = f
  }

  const schedule = parseScheduleDays(raw.schedule)
  if (schedule.length === 0) {
    throw new KyowontourRegisterParseError('schedule must have at least one day')
  }

  const parsed: KyowontourRegisterParsed = {
    productCode,
    title,
    durationLabel,
    priceAdult,
    priceChild,
    priceInfant,
    fuelSurcharge: fuel,
    currency,
    flightFromBody: parseFlightFromBody(raw.flightFromBody),
    schedule,
    meetingInfo: parseMeeting(raw.meetingInfo),
    hotelGradeLabel: asString(raw.hotelGradeLabel).trim() || undefined,
    includedItems: asStringArray(raw.includedItems),
    excludedItems: asStringArray(raw.excludedItems),
    optionalToursFromBody: parseOptionalTours(raw.optionalToursFromBody),
    shoppingItemsFromBody: parseShopping(raw.shoppingItemsFromBody),
    originalBodyText: clippedOriginalBody,
  }

  return parsed
}

export type ExtractKyowontourRegisterWithGeminiOptions = {
  /** 연결 테스트 생략(반복 호출 최적화 시) */
  skipConnectionTest?: boolean
}

/**
 * 교원이지 상세 본문 → Gemini 단일 호출로 구조화 JSON 추출.
 */
export async function extractKyowontourRegisterWithGemini(
  bodyText: string,
  options?: ExtractKyowontourRegisterWithGeminiOptions
): Promise<KyowontourRegisterGeminiResult> {
  const clipped = clipKyowontourRegisterBodyText(bodyText)
  if (!clipped) {
    throw new KyowontourRegisterParseError('empty bodyText')
  }

  if (!options?.skipConnectionTest) {
    const conn = await testGeminiConnection()
    if (!conn.ok) {
      throw new KyowontourRegisterParseError(`Gemini connection failed: ${conn.error ?? 'unknown'}`, {
        rawSnippet: conn.message,
      })
    }
  }

  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: getModelName() })
  const prompt = buildKyowontourRegisterPrompt(clipped)

  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: KYOWONTOUR_REGISTER_MAX_OUTPUT_TOKENS,
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts(GEMINI_GENERATE_TIMEOUT_MS)
  )

  const finishReason = result.response.candidates?.[0]?.finishReason ?? null
  const text = result.response.text() ?? ''
  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[${SUPPLIER_KEY}-register-llm] finishReason=MAX_TOKENS (JSON 잘림 가능)`, {
      length: text.length,
      endsWithBrace: text.trimEnd().endsWith('}'),
    })
  }

  const parsed = parseKyowontourRegisterGeminiResponse(text, clipped)
  return {
    parsed,
    rawText: text,
    model: getModelName(),
    finishReason,
  }
}
