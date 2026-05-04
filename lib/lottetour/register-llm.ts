/**
 * 롯데관광(lottetour) — 상품 본문 붙여넣기 → Gemini JSON 1회 추출 (Phase 2-A).
 * orchestration / 관리자 UI / DB upsert는 후속 Phase에서 연결한다.
 *
 * 패턴 참고(읽기 전용): `lib/kyowontour/register-llm.ts` — 구현은 lottetour 전용이며 공통 모듈로 분리하지 않는다.
 */
import {
  BONGTOUR_TONE_MANNER_LLM_BLOCK,
  LLM_JSON_OUTPUT_DISCIPLINE_BLOCK,
  REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO,
  REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK,
} from '@/lib/bongtour-tone-manner-llm-ssot'
import { geminiTimeoutOpts, getGenAI, getModelName, GEMINI_GENERATE_TIMEOUT_MS, testGeminiConnection } from '@/lib/gemini-client'
import { parseLlmJsonObject } from '@/lib/llm-json-extract'

const SUPPLIER_KEY = 'lottetour' as const

/** 붙여넣기 본문 상한 */
export const LOTTETOUR_REGISTER_BODY_MAX_CHARS = 32_000

/** 단일 Gemini 호출 출력 상한 (롯데관광 본문·일정이 길어 16k~24k 권장) */
const LOTTETOUR_REGISTER_MAX_OUTPUT_TOKENS = Math.max(
  16_384,
  Math.min(24_576, Number(process.env.LOTTETOUR_REGISTER_MAX_OUTPUT_TOKENS) || 20_480)
)

// --- Types (lottetour 전용, kyowontour와 공유하지 않음) ---

export type LottetourFlightSegment = {
  flightNo: string
  departureDateTime: string
  arrivalDateTime: string
  from: string
  to: string
}

export type LottetourFlightFromBody = {
  airline: string
  outbound: LottetourFlightSegment
  inbound: LottetourFlightSegment
}

export type LottetourOptionalTourFromBody = {
  name: string
  duration?: string
  priceAdult?: number
  priceChild?: number
  currency?: 'EUR' | 'USD' | 'KRW'
  alternativeProgram?: string
  guideAccompany?: boolean
}

export type LottetourShoppingItemFromBody = {
  itemName: string
  shopLocation?: string
  duration?: string
  refundable?: string
}

export type LottetourScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type LottetourScheduleDayParsed = {
  dayNumber: number
  date?: string
  title?: string
  cities?: string[]
  activities: string[]
  hotel?: string
  meals: LottetourScheduleMeals
}

export type LottetourMeetingInfo = {
  location: string
  time?: string
}

export type LottetourHotelListEntry = {
  city: string
  name: string
}

export type LottetourTourLeaderFromBody = {
  available: boolean
  feeRaw?: string
  feeAmount?: number
  feeCurrency?: 'EUR' | 'USD' | 'KRW'
}

export type LottetourCategoryMenuNo = {
  no1: string
  no2: string
  no3: string
  no4: string
}

/** Gemini 1회 추출 결과 (관리자 항공·옵션·쇼핑 입력이 있으면 후속 Phase에서 우선 적용) */
export type LottetourRegisterParsed = {
  godId: string
  evtCd?: string
  productCode: string
  /** 공급사 페이지 제목·상품명 원문 그대로 (재생성·톤 변환 금지) */
  title: string
  durationLabel: string

  priceAdult: number
  /** 소아(만 12세 미만 등 본문 기준) — 본문 숫자 그대로; 성인가 연동은 Phase 2-D upsert */
  priceChild: number
  /** 유아 — 본문·표에 있는 유아가 그대로 */
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'

  /** 본문에 편명·시각이 있을 때만. 관리자 항공 입력이 Phase 2-G에서 우선 */
  flightFromBody?: LottetourFlightFromBody | null

  /** DAY 1 ~ DAY N (SSR 일정 블록 기준으로 일차 분리) */
  schedule: LottetourScheduleDayParsed[]

  meetingInfo?: LottetourMeetingInfo | null
  hotelGradeLabel?: string
  hotelList?: LottetourHotelListEntry[]

  includedItems: string[]
  /** 현지비용·1인객실료·인솔자/가이드/기사경비(현지 지불) 등 본문 명시만 */
  excludedItems: string[]

  tourLeader?: LottetourTourLeaderFromBody | null

  optionalToursFromBody?: LottetourOptionalTourFromBody[] | null
  shoppingItemsFromBody?: LottetourShoppingItemFromBody[] | null

  seatUpgradeOptions?: string[]
  categoryMenuNo?: LottetourCategoryMenuNo

  /** 감사·E2E 매칭용으로 클리핑된 원문 전체 */
  originalBodyText: string
}

export class LottetourRegisterParseError extends Error {
  readonly code = 'LottetourRegisterParseError' as const
  constructor(
    message: string,
    readonly details?: { rawSnippet?: string; cause?: unknown }
  ) {
    super(message)
    this.name = 'LottetourRegisterParseError'
  }

  static is(e: unknown): e is LottetourRegisterParseError {
    return e instanceof LottetourRegisterParseError
  }
}

export type LottetourRegisterGeminiResult = {
  parsed: LottetourRegisterParsed
  rawText: string
  model: string
  finishReason: string | null
}

// --- Prompt ---

const REGISTER_LOTTETOUR_ROLE_BLOCK = `# Role: 롯데관광(lottetour) 상품 본문 추출 전용
- 공급사: lottetour (롯데관광). URL 구조: /evtDetail/{menuNo1}/{menuNo2}/{menuNo3}/{menuNo4}?evtCd=… — 본문에 menuNo·evtCd·godId·상품코드가 있으면 해당 필드에 옮긴다.
- **godId**: 마스터 상품 ID (숫자 문자열, 예: "65222"). 본문·표에 없으면 빈 문자열 금지 — 반드시 본문에서 찾는다.
- **evtCd**: 행사 코드(예: E01A260624KE007). 없으면 null.
- **productCode**: 표시 상품코드(예: E01A-0765222). 하이픈·대소문자 본문 그대로.
- **title**: 본문 상단 상품명을 **한 글자도 창작·요약·톤 변경 없이** 그대로 옮긴다.
- **가격**: 숫자만. 천 단위 콤마·'원'·공백 제거. 성인·소아·유아는 본문 표기 그대로. 유류할증료는 본문이 "포함"이면 includedItems 성격으로 서술될 수 있으나 **fuelSurcharge 필드**에는 별도 금액이 있으면 숫자로 넣고, 본문이 "불포함·별도"면 excludedItems에도 반영한다.
- **포함/불포함**: 본문 블록에 명시된 항목만 배열로 나눈다. **인솔자/가이드/기사경비**(현지 지불)·**현지필수경비·1인객실료·싱글차지** 등은 반드시 excludedItems에 포함시키도록 본문을 확인한다.
- **일정**: 본문의 DAY 1 ~ DAY N(또는 1일차~N일차) 블록을 **일차 수만큼** schedule 배열로 분리한다. 각 일차의 관광·이동·설명은 activities[]에 원문에 가깝게 줄 단위·문장 단위로 넣는다(창작 금지). 식사·호텔은 meals·hotel에 본문 표기만.
- **선택관광·쇼핑**: 본문·표에 행이 있으면 추출. € 표기 시 optionalToursFromBody[].currency = "EUR". 없으면 null.
- **항공**: 본문에 항공사·편명·출도착 시각이 명확할 때만 flightFromBody. 불명확하면 null (관리자 항공 입력 우선).
- **좌석 승급**: 본문에 승급 옵션 문구가 있으면 seatUpgradeOptions 문자열 배열.
`

const LOTTETOUR_JSON_SHAPE_INSTRUCTION = `# 출력 JSON 필드 (모두 필수 키 존재; 없으면 null·빈 배열·빈 문자열 규칙)
{
  "godId": string,
  "evtCd": string | null,
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
    "outbound": { "flightNo": string, "departureDateTime": string, "arrivalDateTime": string, "from": string, "to": string },
    "inbound": { "flightNo": string, "departureDateTime": string, "arrivalDateTime": string, "from": string, "to": string }
  } | null,
  "schedule": [
    {
      "dayNumber": number,
      "date": string | null,
      "title": string | null,
      "cities": string[] | null,
      "activities": string[],
      "hotel": string | null,
      "meals": { "breakfast": string, "lunch": string, "dinner": string }
    }
  ],
  "meetingInfo": { "location": string, "time": string | null } | null,
  "hotelGradeLabel": string | null,
  "hotelList": [ { "city": string, "name": string } ] | null,
  "includedItems": string[],
  "excludedItems": string[],
  "tourLeader": { "available": boolean, "feeRaw": string | null, "feeAmount": number | null, "feeCurrency": "EUR"|"USD"|"KRW" | null } | null,
  "optionalToursFromBody": [
    { "name": string, "duration": string | null, "priceAdult": number | null, "priceChild": number | null, "currency": "EUR"|"USD"|"KRW" | null, "alternativeProgram": string | null, "guideAccompany": boolean | null }
  ] | null,
  "shoppingItemsFromBody": [ { "itemName": string, "shopLocation": string | null, "duration": string | null, "refundable": string | null } ] | null,
  "seatUpgradeOptions": string[],
  "categoryMenuNo": { "no1": string, "no2": string, "no3": string, "no4": string } | null,
  "originalBodyText": string
}

originalBodyText에는 입력 본문(클리핑된 전체)을 그대로 반복해 넣는다.
`

function buildLottetourRegisterPrompt(clippedBody: string): string {
  return [
    REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO.trim(),
    REGISTER_LOTTETOUR_ROLE_BLOCK.trim(),
    BONGTOUR_TONE_MANNER_LLM_BLOCK.trim(),
    LLM_JSON_OUTPUT_DISCIPLINE_BLOCK.trim(),
    REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK.trim(),
    `# lottetour 일정 보충
- schedule[].activities[]는 해당 일차 SSR/표의 **원문 팩트**를 우선한다. title·cities·date는 본문에 있으면 채우고 없으면 null.
`,
    LOTTETOUR_JSON_SHAPE_INSTRUCTION.trim(),
    '',
    '--- SUPPLIER_BODY_START ---',
    clippedBody,
    '--- SUPPLIER_BODY_END ---',
  ].join('\n\n')
}

/** 붙여넣기 전처리: 개행 정규화 + 길이 클리핑 */
export function clipLottetourRegisterBodyText(text: string, maxChars: number = LOTTETOUR_REGISTER_BODY_MAX_CHARS): string {
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
  throw new LottetourRegisterParseError(`invalid number: ${field}`)
}

function asOptionalFiniteNumber(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined
  const s = String(v).trim()
  if (!s) return undefined
  try {
    return asFiniteNumber(v, 'optional')
  } catch {
    return undefined
  }
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => asString(x).trim()).filter(Boolean)
}

function parseMeals(v: unknown): LottetourScheduleMeals {
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

function parseFlightSegment(v: unknown): LottetourFlightSegment {
  if (!v || typeof v !== 'object' || Array.isArray(v)) {
    return { flightNo: '', departureDateTime: '', arrivalDateTime: '', from: '', to: '' }
  }
  const o = v as Record<string, unknown>
  return {
    flightNo: asString(o.flightNo),
    departureDateTime: asString(o.departureDateTime),
    arrivalDateTime: asString(o.arrivalDateTime),
    from: asString(o.from),
    to: asString(o.to),
  }
}

function parseFlightFromBody(v: unknown): LottetourFlightFromBody | null {
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

function parseOptionalCurrency(v: unknown): 'EUR' | 'USD' | 'KRW' | undefined {
  const u = asString(v).toUpperCase()
  if (u === 'EUR' || u === 'USD' || u === 'KRW') return u
  return undefined
}

function parseOptionalTours(v: unknown): LottetourOptionalTourFromBody[] | null {
  if (v === null || v === undefined) return null
  if (!Array.isArray(v)) return null
  if (v.length === 0) return null
  const out: LottetourOptionalTourFromBody[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const name = asString(r.name).trim()
    if (!name) continue
    const entry: LottetourOptionalTourFromBody = { name }
    const dur = asString(r.duration).trim()
    if (dur) entry.duration = dur
    const pa = asOptionalFiniteNumber(r.priceAdult)
    if (pa !== undefined) entry.priceAdult = pa
    const pc = asOptionalFiniteNumber(r.priceChild)
    if (pc !== undefined) entry.priceChild = pc
    const cur = parseOptionalCurrency(r.currency)
    if (cur) entry.currency = cur
    const alt = asString(r.alternativeProgram).trim()
    if (alt) entry.alternativeProgram = alt
    if (typeof r.guideAccompany === 'boolean') entry.guideAccompany = r.guideAccompany
    out.push(entry)
  }
  return out.length ? out : null
}

function parseShopping(v: unknown): LottetourShoppingItemFromBody[] | null {
  if (v === null || v === undefined) return null
  if (!Array.isArray(v)) return null
  if (v.length === 0) return null
  const out: LottetourShoppingItemFromBody[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const itemName = asString(r.itemName).trim()
    if (!itemName) continue
    const entry: LottetourShoppingItemFromBody = { itemName }
    const sl = asString(r.shopLocation).trim()
    if (sl) entry.shopLocation = sl
    const dur = asString(r.duration).trim()
    if (dur) entry.duration = dur
    const ref = asString(r.refundable).trim()
    if (ref) entry.refundable = ref
    out.push(entry)
  }
  return out.length ? out : null
}

function parseMeeting(v: unknown): LottetourMeetingInfo | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  const location = asString(o.location).trim()
  const time = asString(o.time).trim()
  if (!location && !time) return null
  return { location, ...(time ? { time } : {}) }
}

function parseCities(v: unknown): string[] | undefined {
  if (v === null || v === undefined) return undefined
  const arr = asStringArray(v)
  return arr.length ? arr : undefined
}

function parseHotelList(v: unknown): LottetourHotelListEntry[] | undefined {
  if (v === null || v === undefined) return undefined
  if (!Array.isArray(v)) return undefined
  const out: LottetourHotelListEntry[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const city = asString(r.city).trim()
    const name = asString(r.name).trim()
    if (!city && !name) continue
    out.push({ city, name })
  }
  return out.length ? out : undefined
}

function parseTourLeader(v: unknown): LottetourTourLeaderFromBody | null {
  if (v === null || v === undefined) return null
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const o = v as Record<string, unknown>
  if (typeof o.available !== 'boolean') return null
  const entry: LottetourTourLeaderFromBody = { available: o.available }
  const feeRaw = asString(o.feeRaw).trim()
  if (feeRaw) entry.feeRaw = feeRaw
  const fa = asOptionalFiniteNumber(o.feeAmount)
  if (fa !== undefined) entry.feeAmount = fa
  const fc = parseOptionalCurrency(o.feeCurrency)
  if (fc) entry.feeCurrency = fc
  return entry
}

function parseCategoryMenuNo(v: unknown): LottetourCategoryMenuNo | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined
  const o = v as Record<string, unknown>
  const no1 = asString(o.no1).trim()
  const no2 = asString(o.no2).trim()
  const no3 = asString(o.no3).trim()
  const no4 = asString(o.no4).trim()
  if (!no1 && !no2 && !no3 && !no4) return undefined
  return { no1, no2, no3, no4 }
}

function parseScheduleDays(v: unknown): LottetourScheduleDayParsed[] {
  if (!Array.isArray(v)) return []
  const days: LottetourScheduleDayParsed[] = []
  for (const row of v) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const r = row as Record<string, unknown>
    const dayNumber = asFiniteNumber(r.dayNumber, 'schedule.dayNumber')
    if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 99) {
      throw new LottetourRegisterParseError('schedule.dayNumber must be integer 1..99')
    }
    const activities = asStringArray(r.activities)
    const date = asString(r.date).trim() || undefined
    const title = asString(r.title).trim() || undefined
    const cities = parseCities(r.cities)
    const hotel = asString(r.hotel).trim() || undefined
    days.push({
      dayNumber,
      ...(date ? { date } : {}),
      ...(title ? { title } : {}),
      ...(cities ? { cities } : {}),
      activities,
      ...(hotel ? { hotel } : {}),
      meals: parseMeals(r.meals),
    })
  }
  days.sort((a, b) => a.dayNumber - b.dayNumber)
  return days
}

/**
 * Gemini 원문 텍스트(JSON) → `LottetourRegisterParsed`.
 * `originalBodyText`는 호출부에서 클리핑된 본문을 주입한다.
 */
export function parseLottetourRegisterGeminiResponse(llmText: string, clippedOriginalBody: string): LottetourRegisterParsed {
  const raw = parseLlmJsonObject<Record<string, unknown>>(llmText, { logLabel: 'lottetour-register-llm' })

  const godId = asString(raw.godId).trim()
  if (!godId) throw new LottetourRegisterParseError('missing godId')

  const evtCdRaw = raw.evtCd
  let evtCd: string | undefined
  if (evtCdRaw !== null && evtCdRaw !== undefined) {
    const e = asString(evtCdRaw).trim()
    if (e) evtCd = e
  }

  const productCode = asString(raw.productCode).trim()
  const title = asString(raw.title).trim()
  if (!productCode) throw new LottetourRegisterParseError('missing productCode')
  if (!title) throw new LottetourRegisterParseError('missing title')

  const currency: 'KRW' = 'KRW'
  const durationLabel = asString(raw.durationLabel).trim()
  if (!durationLabel) throw new LottetourRegisterParseError('missing durationLabel')

  const priceAdult = asFiniteNumber(raw.priceAdult, 'priceAdult')
  const priceChild = asFiniteNumber(raw.priceChild, 'priceChild')
  const priceInfant = asFiniteNumber(raw.priceInfant, 'priceInfant')
  if (priceAdult < 0 || priceChild < 0 || priceInfant < 0) {
    throw new LottetourRegisterParseError('prices must be non-negative')
  }

  let fuel: number | undefined
  if (raw.fuelSurcharge !== null && raw.fuelSurcharge !== undefined && String(raw.fuelSurcharge).trim() !== '') {
    const f = asFiniteNumber(raw.fuelSurcharge, 'fuelSurcharge')
    if (f >= 0) fuel = f
  }

  const schedule = parseScheduleDays(raw.schedule)
  if (schedule.length === 0) {
    throw new LottetourRegisterParseError('schedule must have at least one day')
  }

  const seatOpts = asStringArray(raw.seatUpgradeOptions)
  const parsed: LottetourRegisterParsed = {
    godId,
    ...(evtCd ? { evtCd } : {}),
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
    hotelList: parseHotelList(raw.hotelList),
    includedItems: asStringArray(raw.includedItems),
    excludedItems: asStringArray(raw.excludedItems),
    tourLeader: parseTourLeader(raw.tourLeader),
    optionalToursFromBody: parseOptionalTours(raw.optionalToursFromBody),
    shoppingItemsFromBody: parseShopping(raw.shoppingItemsFromBody),
    ...(seatOpts.length ? { seatUpgradeOptions: seatOpts } : {}),
    categoryMenuNo: parseCategoryMenuNo(raw.categoryMenuNo),
    originalBodyText: clippedOriginalBody,
  }

  return parsed
}

export type ExtractLottetourRegisterWithGeminiOptions = {
  skipConnectionTest?: boolean
}

/**
 * 롯데관광 상세 본문 → Gemini 단일 호출로 구조화 JSON 추출.
 */
export async function extractLottetourRegisterWithGemini(
  bodyText: string,
  options?: ExtractLottetourRegisterWithGeminiOptions
): Promise<LottetourRegisterGeminiResult> {
  const clipped = clipLottetourRegisterBodyText(bodyText)
  if (!clipped) {
    throw new LottetourRegisterParseError('empty bodyText')
  }

  if (!options?.skipConnectionTest) {
    const conn = await testGeminiConnection()
    if (!conn.ok) {
      throw new LottetourRegisterParseError(`Gemini connection failed: ${conn.error ?? 'unknown'}`, {
        rawSnippet: conn.message,
      })
    }
  }

  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: getModelName() })
  const prompt = buildLottetourRegisterPrompt(clipped)

  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: LOTTETOUR_REGISTER_MAX_OUTPUT_TOKENS,
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

  const parsed = parseLottetourRegisterGeminiResponse(text, clipped)
  return {
    parsed,
    rawText: text,
    model: getModelName(),
    finishReason,
  }
}

// --- Self-test (Phase 2-A 검증, CI 없음 시 수동 실행) ---
// PowerShell: $env:LOTTETOUR_REGISTER_LLM_SELFTEST='1'; npx tsx lib/lottetour/register-llm.ts

function selfAssert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`[lottetour-register-llm selftest] ${message}`)
}

/** 베니스/돌로미티 예시에 대응하는 **모의 LLM JSON** 파싱 검증 (네트워크 없음) */
export function runLottetourRegisterLlmSelfTests(): void {
  const clippedBody = 'SELFTEST_CLIPPED_BODY'
  const mockLlmJson = JSON.stringify({
    godId: '65222',
    evtCd: 'E01A260624KE007',
    productCode: 'E01A-0765222',
    title:
      '★출발확정★[③팀][선착순 50만원할인][대한항공/돌로미티/직항전세기]『베니스 운하를 지나 돌로미티 파노라마에 닿는 여정』이탈리아 완전일주 9일',
    durationLabel: '7박9일',
    priceAdult: 6990000,
    priceChild: 6990000,
    priceInfant: 800000,
    fuelSurcharge: 1000000,
    currency: 'KRW',
    flightFromBody: null,
    schedule: Array.from({ length: 9 }, (_, i) => ({
      dayNumber: i + 1,
      date: null,
      title: null,
      cities: null,
      activities: [`DAY ${i + 1} 활동 placeholder`],
      hotel: null,
      meals: { breakfast: '', lunch: '', dinner: '' },
    })),
    meetingInfo: null,
    hotelGradeLabel: null,
    hotelList: null,
    includedItems: ['대한항공 왕복 항공료'],
    excludedItems: ['인솔자/가이드/기사경비 100유로(현지 지불)', '유류할증료 별도 고지 시 불포함'],
    tourLeader: { available: true, feeRaw: '1인 100유로', feeAmount: 100, feeCurrency: 'EUR' },
    optionalToursFromBody: null,
    shoppingItemsFromBody: null,
    seatUpgradeOptions: [],
    categoryMenuNo: null,
    originalBodyText: clippedBody,
  })

  const p = parseLottetourRegisterGeminiResponse(mockLlmJson, clippedBody)
  selfAssert(p.godId === '65222', 'godId')
  selfAssert(p.evtCd === 'E01A260624KE007', 'evtCd')
  selfAssert(p.productCode === 'E01A-0765222', 'productCode')
  selfAssert(p.priceAdult === 6990000, 'priceAdult')
  selfAssert(p.fuelSurcharge === 1000000, 'fuelSurcharge')
  selfAssert(p.schedule.length === 9, 'schedule length 9')
  selfAssert(
    p.excludedItems.some((s) => s.includes('인솔자/가이드/기사경비')),
    'excludedItems must mention 인솔자/가이드/기사경비'
  )
  selfAssert(p.originalBodyText === clippedBody, 'originalBodyText injection')
}

if (typeof process !== 'undefined' && process.env.LOTTETOUR_REGISTER_LLM_SELFTEST === '1') {
  runLottetourRegisterLlmSelfTests()
  console.log('[lottetour-register-llm] selftest OK')
}
