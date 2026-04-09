/**
 * 노랑풍선(ybtour) 전용 Gemini JSON → RegisterParsed (LLM 본체). `register-parse-ybtour`만 호출.
 */
import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'
import {
  inferExpectedScheduleDayCountFromPaste,
  mergeScheduleWithFirstPassPreferExtractRows,
  registerPromptWithScheduleEmptyForConfirm,
  runScheduleExtractLlm,
  type CommonScheduleDayRow,
} from '@/lib/register-schedule-extract-common'
import {
  BONGTOUR_TONE_MANNER_LLM_BLOCK,
  LLM_JSON_OUTPUT_DISCIPLINE_BLOCK,
  REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO,
  REGISTER_PREVIEW_MINIMAL_TONE_BLOCK,
  REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK,
} from '@/lib/bongtour-tone-manner-llm-ssot'

/**
 * 풀 등록(`forPreview: false`) JSON 출력 상한. 호텔·일정 배열이 길면 32k에서 MAX_TOKENS 잘림이 난다.
 * `GEMINI_REGISTER_FULL_MAX_OUTPUT_TOKENS`로 조정(모델 상한 내).
 */
const REGISTER_FULL_MAX_OUTPUT_TOKENS = Math.max(
  8192,
  Math.min(131072, Number(process.env.GEMINI_REGISTER_FULL_MAX_OUTPUT_TOKENS) || 65536)
)
import type { ParsedProductPrice } from './parsed-product-types'
import { normalizeCalendarDate } from './date-normalize'
import { extractDestinationFromTitle } from './destination-from-title'
import { normalizeOriginSource } from './supplier-origin'
import { extractStructuredTourSignals } from './structured-tour-signals-ybtour'
import type { StructuredOptionalTourRow, StructuredShoppingStopRow } from './structured-tour-signals-ybtour'
import {
  buildRegisterLlmInputBlocks,
  buildRegisterPreviewMinimalLlmInputBlocks,
  segmentSupplierPasteForLlm,
  type RegisterPastedBlocksInput,
} from '@/lib/register-llm-blocks-ybtour'
import {
  enrichParsedPricesInboundArrivalDateFromRawBlob,
  enrichParsedProductPricesWithFlightHeuristics,
  mergeProductLevelFlightSegments,
} from './flight-leg-heuristics'
import { MAX_OPTIONAL_TOURS, OPTIONAL_TOUR_UI_MAX_ROWS } from '@/lib/optional-tour-limits'
import { filterOptionalTourRows, optionalTourRowPassesStrictGate, type OptionalTourRowFields } from '@/lib/optional-tour-row-gate-ybtour'
import { shoppingStructuredRowToPersistStop } from '@/lib/shopping-structured-row-to-persist'
import { isMustKnowInsufficient, supplementMustKnowWithWebSearch } from './must-know-web-supplement'
import { parseLlmJsonObject } from './llm-json-extract'
import {
  mergeDayHotelPlansForRegister,
  parseDayHotelPlansFromSupplierText,
  type DayHotelPlan,
} from '@/lib/day-hotel-plans-ybtour'
import { mergeInfantPriceIntoProductPriceTable } from '@/lib/infant-price-extract'
import {
  extractProductPriceTableByLabels,
  mergeProductPriceTableWithLabelExtract,
} from '@/lib/product-price-table-extract'
import { extractMinimumDepartureMeta, buildDepartureStatusDisplay } from '@/lib/minimum-departure-extract'
import type { DetailBodyParseSnapshot } from '@/lib/detail-body-parser'
import {
  RegisterLlmParseError,
  type CalendarItem,
  type DirectedFlightLineResolver,
  type RegisterExtractionFieldIssue,
  type RegisterGeminiLlmJson,
  type RegisterLlmParseOptionsCommon,
  type RegisterParseAudit,
  type RegisterParsed,
  type RegisterScheduleDay,
} from '@/lib/register-llm-schema-ybtour'


/** preset 없을 때 비표시 — 노랑풍선은 `resolveDirectedFlightLinesYbtour` 주입 전제 */
function resolveDirectedFlightLinesDefault(_detailBody: DetailBodyParseSnapshot): {
  departureSegmentFromStructured: string | null
  returnSegmentFromStructured: string | null
} {
  return { departureSegmentFromStructured: null, returnSegmentFromStructured: null }
}
import { buildOptionalToursStructuredForRegisterJson } from '@/lib/register-optional-tours-detail-final-merge'
import { readManualPasteAxesFromBlocks } from '@/lib/register-manual-paste-ssot'
import {
  filterRegisterExtractionIssuesShoppingGeminiNoise,
  shouldEmitShoppingBothEmptyExtractionIssue,
} from '@/lib/review-policy-ybtour'
import { decideSectionRepairPolicy, runDetailSectionGeminiRepair } from '@/lib/gemini-repair-chain'
import {
  buildDestinationCoherenceFieldIssues,
  normalizeDestinationExtractionIssuesInPlace,
} from '@/lib/register-destination-coherence'
import { parsePricePromotionFromGeminiJson, type PricePromotionSnapshot } from './price-promotion-ybtour'
import { buildSingleRoomExcludedLine } from '@/lib/product-excluded-display'

/** parse/route TEXT_LIMIT(26k)보다 넉넉히 — 등록 프롬프트가 더 길어 32k. 초과분은 잘라 입력 토큰·지연을 줄임 */
const REGISTER_PASTE_MAX_CHARS = 32000
const MAX_SHOPPING_STOPS = 15

const REGISTER_BRAND = 'ybtour' as const

const EMPTY_PASTE_PLACEHOLDER =
  '((관리자 복붙 본문 없음 — 붙여넣은 텍스트가 필수. prices·schedule은 빈 배열 [] 로 둘 것. URL·외부 수집 추측 금지.))'

function normalizeRegisterPasteNewlines(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

/**
 * extractStructuredTourSignals / extractOptionalToursStructured 입력용.
 * 쇼핑·옵션을 본문과 별도 블록으로 붙인 경우 primary(복붙 본문)에 표가 없으면 signals가 비는 문제를 막는다.
 * 본문에 이미 포함된 블록은 중복 합치지 않는다(`register-llm-blocks-ybtour` omit 규칙과 동일한 ⊂ 판별).
 */
function buildRegisterSignalsHaystack(
  rawText: string,
  pastedBodyForInference: string | null | undefined,
  pastedBlocks: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null | undefined
): string {
  const primary = normalizeRegisterPasteNewlines(
    (pastedBodyForInference?.trim() || rawText.trim()).slice(0, REGISTER_PASTE_MAX_CHARS)
  )
  const parts: string[] = []
  if (primary) parts.push(primary)
  const appendIfExtra = (block: string | null | undefined) => {
    const b = normalizeRegisterPasteNewlines((block ?? '').trim())
    if (b.length < 8) return
    if (primary.includes(b)) return
    parts.push(b)
  }
  appendIfExtra(pastedBlocks?.optionalTour ?? null)
  appendIfExtra(pastedBlocks?.shopping ?? null)
  return parts.join('\n\n\n').slice(0, REGISTER_PASTE_MAX_CHARS)
}

/** 전용 입력란 비어 있을 때 본문·regex·LLM 해당 축 미사용 — 노랑풍선(ybtour) 이 파일 전용 */
function ybtourClearLlmWhenDedicatedPasteEmpty(
  raw: RegisterGeminiLlmJson,
  pb: Partial<RegisterPastedBlocksInput> | undefined
): void {
  const r = raw as unknown as Record<string, unknown>
  if (!String(pb?.optionalTour ?? '').trim()) {
    r.optionalTours = []
    r.optionalTourNoticeRaw = null
    r.optionalTourNoticeItems = []
    r.optionalTourCount = null
    r.hasOptionalTour = false
    r.optionalTourSummaryText = null
  }
  if (!String(pb?.shopping ?? '').trim()) {
    r.shoppingStops = []
    r.shoppingNoticeRaw = null
    r.hasShopping = false
    r.shoppingVisitCount = null
    r.shoppingSummaryText = null
  }
  if (!String(pb?.airlineTransport ?? '').trim()) {
    r.airline = null
    r.airlineName = null
    r.departureSegmentText = null
    r.returnSegmentText = null
    r.outboundFlightNo = null
    r.inboundFlightNo = null
    r.departureDateTimeRaw = null
    r.arrivalDateTimeRaw = null
    r.routeRaw = null
  }
}

function ybtourBlankSignalsWhenDedicatedPasteEmpty(
  signals: ReturnType<typeof extractStructuredTourSignals>,
  pb: Partial<RegisterPastedBlocksInput> | undefined
): ReturnType<typeof extractStructuredTourSignals> {
  const o = { ...(signals as unknown as Record<string, unknown>) }
  if (!String(pb?.optionalTour ?? '').trim()) {
    o.optionalToursStructuredJson = null
    o.optionalTourNoticeRaw = null
    o.optionalTourNoticeItems = []
    o.optionalTours = []
    o.hasOptionalTour = false
    o.optionalTourCount = 0
    o.optionalTourSourceCount = 0
    o.optionalTourSummaryText = ''
    if (o.headerBadges && typeof o.headerBadges === 'object') {
      o.headerBadges = { ...(o.headerBadges as Record<string, unknown>), optionalTour: '현지옵션 없음' }
    }
  }
  if (!String(pb?.shopping ?? '').trim()) {
    o.shoppingStopsJson = null
    o.shoppingNoticeRaw = null
    o.shoppingStops = []
    o.hasShopping = false
    o.shoppingVisitCount = null
    o.shoppingSourceCount = 0
    o.shoppingSummaryText = ''
  }
  return o as unknown as ReturnType<typeof extractStructuredTourSignals>
}

function clipRegisterLlmAuditText(s: string): string {
  const raw = process.env.REGISTER_LLM_AUDIT_MAX_CHARS?.trim()
  const n = raw ? Number(raw) : NaN
  const max = Number.isFinite(n) && n > 0 ? n : 400_000
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`
}

function clipRegisterAdminLlmParsedJsonString(s: string): string {
  const raw =
    process.env.REGISTER_ADMIN_LLM_PARSED_MAX_CHARS?.trim() ??
    process.env.REGISTER_PIPELINE_LLM_PARSED_MAX_CHARS?.trim()
  const n = raw ? Number(raw) : NaN
  const max = Number.isFinite(n) && n > 0 ? n : 800_000
  if (s.length <= max) return s
  return `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]`
}

function stripHtmlForPriceBlob(html: string | null | undefined): string {
  if (!html?.trim()) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function allowedCategoryForSupplement(
  c: string
): NonNullable<RegisterParsed['mustKnowItems']>[0]['category'] {
  const s = c.trim()
  if (
    s === '입국/비자' ||
    s === '자녀동반' ||
    s === '현지준비' ||
    s === '안전/유의' ||
    s === '국내준비' ||
    s === '집결/탑승'
  )
    return s
  return '현지준비'
}

function inferProductTypeFromText(rawText: string, title: string): string {
  const hay = `${rawText}\n${title}`.toLowerCase()
  if (/(에어텔|air[\s-]?tel|항공\s*\+?\s*호텔|항공권\s*\+?\s*호텔)/i.test(hay)) return 'airtel'
  if (/(세미\s*패키지|세미패키지|semi|준패키지|1\s*일\s*자유)/i.test(hay)) return 'semi'
  if (/(우리끼리|단독\s*행사|맞춤\s*여행|소그룹)/i.test(hay)) return 'private'
  return 'travel'
}

function extractAirtelHotelInfoJson(rawText: string): string | null {
  const text = rawText.replace(/\r/g, '')
  const pick = (re: RegExp): string | null => {
    const m = text.match(re)
    return m?.[1]?.trim() ? m[1].trim().slice(0, 300) : null
  }
  const info = {
    hotelName: pick(/(?:호텔명|숙소명)\s*[:：]\s*([^\n]+)/i),
    hotelGrade: pick(/(?:성급|호텔등급)\s*[:：]\s*([^\n]+)/i),
    stayNights: pick(/(?:숙박\s*일수|숙박\s*박수)\s*[:：]?\s*([^\n]+)/i),
    roomType: pick(/(?:객실\s*타입|객실유형)\s*[:：]\s*([^\n]+)/i),
    breakfastIncluded: pick(/(?:조식\s*포함|조식여부)\s*[:：]?\s*([^\n]+)/i),
    hotelArea: pick(/(?:호텔\s*위치|위치|지역)\s*[:：]\s*([^\n]+)/i),
    hotelSummary: pick(/(?:호텔\s*설명|숙소\s*설명|호텔\s*소개)\s*[:：]\s*([^\n]+)/i),
    hotelImageUrl: pick(/(?:호텔\s*이미지|대표\s*이미지)\s*[:：]\s*(https?:\/\/[^\s]+)/i),
    hotelDetailUrl: pick(/(?:호텔\s*상세|숙소\s*상세|호텔\s*링크)\s*[:：]\s*(https?:\/\/[^\s]+)/i),
  }
  const hasAny = Object.values(info).some((v) => typeof v === 'string' && v.length > 0)
  return hasAny ? JSON.stringify(info) : null
}

function inferAirportTransferType(rawText: string): 'NONE' | 'PICKUP' | 'SENDING' | 'BOTH' {
  const t = rawText.toLowerCase()
  const hasPickup = /(공항\s*픽업|픽업\s*포함|pickup)/i.test(t)
  const hasSending = /(공항\s*샌딩|샌딩\s*포함|sending|drop\s*off|dropoff)/i.test(t)
  if (hasPickup && hasSending) return 'BOTH'
  if (hasPickup) return 'PICKUP'
  if (hasSending) return 'SENDING'
  return 'NONE'
}

function extractOptionalToursStructured(rawText: string): string | null {
  const lines = rawText
    .replace(/\r/g, '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean)
  const tours: Array<Record<string, unknown>> = []
  for (const line of lines) {
    if (!/(선택관광|옵션투어|옵셔널|현지\s*옵션|현지\s*선택|추가\s*관광|별도\s*선택|선택\s*일정)/i.test(line)) continue
    const ln = line.trim()
    // UI 반복 라벨(아이콘 옆 '선택관광' '있음' 등)은 항목으로 취급하지 않음
    if (/^선택관광\s*$/i.test(ln)) continue
    if (/^선택관광\s*[:：]?\s*(있음|없음)\s*$/i.test(ln)) continue
    if (/^선택관광\s*안내\s*$/i.test(ln)) continue
    const price = line.match(/(?:\$|USD|usd)\s*([0-9][0-9,]*)|([0-9][0-9,]*)\s*(?:USD|usd|달러)/)
    const priceNumRaw = price?.[1] ?? price?.[2] ?? null
    const priceValue = priceNumRaw ? Number(String(priceNumRaw).replace(/,/g, '')) : null
    const name = line
      .replace(/\[(선택관광|옵션투어|옵셔널)\]/gi, '')
      .replace(/(선택관광|옵션투어|옵셔널)/gi, '')
      .replace(/[:：-]\s*/g, ' ')
      .trim()
      .slice(0, 120)
    // 가격도 없고 실질 제목도 없으면 스킵(남는 게 '선택관광' 뿐인 행)
    const strippedLabel = name.replace(/선택관광|옵션투어|옵셔널|\s/gi, '')
    if (!priceNumRaw && (!name || name === '현지옵션' || strippedLabel.length < 3)) continue
    const gateRow: OptionalTourRowFields = {
      name: name || '현지옵션',
      currency: priceNumRaw ? 'USD' : null,
      adultPrice: priceValue != null && Number.isFinite(priceValue) ? priceValue : null,
      childPrice: null,
      durationText: null,
      minPaxText: null,
      guide同行Text: null,
      waitingPlaceText: null,
      raw: line.slice(0, 400),
    }
    if (!optionalTourRowPassesStrictGate(gateRow)) continue
    tours.push({
      name: gateRow.name,
      priceText: priceNumRaw ? `USD ${Number(priceNumRaw.replace(/,/g, '')).toLocaleString()}` : '',
      priceValue: priceValue && Number.isFinite(priceValue) ? priceValue : undefined,
      currency: priceNumRaw ? 'USD' : undefined,
      description: line.slice(0, 300),
      // 공급사 문구가 애매하면 inquire로 보수적으로 분류
      bookingType:
        /현지\s*신청|현장\s*신청/.test(line)
          ? 'onsite'
          : /사전\s*신청|예약\s*필수/.test(line)
            ? 'pre'
            : /문의|확인\s*필요|협의/.test(line)
              ? 'inquire'
              : 'unknown',
      rawText: line.slice(0, 400),
      autoExtracted: true,
    })
  }
  return tours.length > 0 ? JSON.stringify(tours) : null
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim()) {
    const n = Number(String(v).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function strOrNull(v: unknown): string | null {
  if (v == null) return null
  const t = String(v).trim()
  return t || null
}

function normalizeDedupText(v: string): string {
  return v
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .trim()
}

function hasSingleRoomSurchargeHint(text: string): boolean {
  return /(1\s*인\s*(?:객실|실)|독실|싱글\s*차지|single\s*(?:room|charge))/i.test(text)
}

function extractSingleRoomSurcharge(rawText: string): {
  amount: number | null
  currency: string | null
  raw: string | null
} {
  const t = rawText.replace(/\r/g, '\n')
  if (!hasSingleRoomSurchargeHint(t)) {
    return { amount: null, currency: null, raw: null }
  }
  const lines = t.split('\n').map((x) => x.trim()).filter(Boolean)
  const matchedLine =
    lines.find(
      (ln) =>
        hasSingleRoomSurchargeHint(ln) &&
        /(추가\s*(?:요금|사용료|비용)|추가|발생|별도)/i.test(ln)
    ) ??
    lines.find((ln) => hasSingleRoomSurchargeHint(ln)) ??
    null

  const source = matchedLine ?? t
  const m = source.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*(원|KRW)?/i)
  const amount = m ? Number(m[1].replace(/,/g, '')) : null
  const currency = amount != null && Number.isFinite(amount) ? 'KRW' : null

  return {
    amount: amount != null && Number.isFinite(amount) ? amount : null,
    currency,
    raw: source.slice(0, 500),
  }
}

function llmOptionalToursToStructured(rows: Array<Record<string, unknown>> | undefined): {
  rows: StructuredOptionalTourRow[]
  sourceCount: number
} {
  if (!rows?.length) return { rows: [], sourceCount: 0 }
  const out: StructuredOptionalTourRow[] = []
  const sourceCount = rows.length
  for (const r of rows) {
    const name = strOrNull(r.name)
    if (!name) continue
    out.push({
      name,
      currency: strOrNull(r.currency),
      adultPrice: numOrNull(r.adultPrice),
      childPrice: numOrNull(r.childPrice),
      durationText: strOrNull(r.durationText),
      minPaxText: strOrNull(r.minPaxText),
      guide同行Text: strOrNull(r.guide同行Text ?? (r as { guideText?: string }).guideText),
      waitingPlaceText: strOrNull(r.waitingPlaceText),
      raw: strOrNull(r.raw) ?? strOrNull((r as { rawText?: string }).rawText) ?? name,
    })
  }
  return { rows: filterOptionalTourRows(out).slice(0, OPTIONAL_TOUR_UI_MAX_ROWS), sourceCount }
}

function llmShoppingToStructured(rows: Array<Record<string, unknown>> | undefined): {
  rows: StructuredShoppingStopRow[]
  sourceCount: number
} {
  if (!rows?.length) return { rows: [], sourceCount: 0 }
  const out: StructuredShoppingStopRow[] = []
  const sourceCount = rows.length
  for (const r of rows) {
    const placeName = strOrNull(r.placeName) ?? strOrNull((r as { place?: string }).place)
    const itemType = strOrNull(r.itemType) ?? ''
    if (!placeName && !itemType) continue
    out.push({
      itemType: itemType || '쇼핑',
      placeName: placeName || itemType || '장소',
      durationText: strOrNull(r.durationText),
      refundPolicyText: strOrNull(r.refundPolicyText),
      raw: strOrNull(r.raw) ?? '',
    })
  }
  return { rows: out.slice(0, MAX_SHOPPING_STOPS), sourceCount }
}

function fingerprintOptionalLikeJson(j: string | null): string {
  if (!j) return ''
  try {
    const arr = JSON.parse(j) as Array<Record<string, unknown>>
    if (!Array.isArray(arr)) return j
    return JSON.stringify(
      arr.map((x) => ({
        n: typeof x?.name === 'string' ? x.name : (x as { placeName?: string }).placeName,
        a: x?.adultPrice ?? (x as { itemType?: string }).itemType,
      }))
    )
  } catch {
    return j
  }
}

function jsonArrayNonEmpty(j: string | null | undefined): boolean {
  if (!j?.trim()) return false
  try {
    const arr = JSON.parse(j) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function capJsonArrayLength(json: string | null, max: number): { json: string | null; originalLen: number; capped: boolean } {
  if (!json?.trim()) return { json: null, originalLen: 0, capped: false }
  try {
    const arr = JSON.parse(json) as unknown[]
    if (!Array.isArray(arr)) return { json, originalLen: 0, capped: false }
    const originalLen = arr.length
    if (originalLen <= max) return { json: JSON.stringify(arr), originalLen, capped: false }
    return { json: JSON.stringify(arr.slice(0, max)), originalLen, capped: true }
  } catch {
    return { json, originalLen: 0, capped: false }
  }
}

/** merge·저장 직전 — 표/LLM/regex 어떤 소스든 2차 필터(금지명·상품속성) */
function sanitizeOptionalToursStructuredJson(json: string | null): string | null {
  if (!json?.trim()) return null
  try {
    const arr = JSON.parse(json) as unknown[]
    if (!Array.isArray(arr)) return null
    const coerced: OptionalTourRowFields[] = []
    for (const el of arr) {
      if (!el || typeof el !== 'object') continue
      const r = el as Record<string, unknown>
      const name = typeof r.name === 'string' ? r.name.trim() : ''
      if (!name) continue
      const row: OptionalTourRowFields = {
        name,
        currency: typeof r.currency === 'string' && r.currency.trim() ? r.currency.trim() : null,
        adultPrice: numOrNull(r.adultPrice ?? r.priceValue),
        childPrice: numOrNull(r.childPrice),
        durationText: typeof r.durationText === 'string' ? r.durationText.trim() || null : null,
        minPaxText: typeof r.minPaxText === 'string' ? r.minPaxText.trim() || null : null,
        guide同行Text:
          (typeof r.guide同行Text === 'string' ? r.guide同行Text : typeof r.guideText === 'string' ? r.guideText : null)?.trim() ||
          null,
        waitingPlaceText:
          typeof r.waitingPlaceText === 'string'
            ? r.waitingPlaceText.trim() || null
            : typeof r.waitPlaceIfNotJoined === 'string'
              ? r.waitPlaceIfNotJoined.trim() || null
              : null,
        raw:
          typeof r.raw === 'string'
            ? r.raw
            : typeof r.rawText === 'string'
              ? r.rawText
              : name,
        priceText: typeof r.priceText === 'string' && r.priceText.trim() ? r.priceText.trim() : null,
        alternateScheduleText:
          typeof r.alternateScheduleText === 'string' && r.alternateScheduleText.trim()
            ? r.alternateScheduleText.trim()
            : null,
      }
      coerced.push(row)
    }
    const filtered = filterOptionalTourRows(coerced)
    return filtered.length > 0 ? JSON.stringify(filtered) : null
  } catch {
    return null
  }
}

function mergeOptionalToursStructured(args: {
  llmRows: Array<Record<string, unknown>> | undefined
  signalsJson: string | null
  lineRegexJson: string | null
}): { final: string | null; llmSupplement: string | null; issues: RegisterExtractionFieldIssue[] } {
  const issues: RegisterExtractionFieldIssue[] = []
  const cap = OPTIONAL_TOUR_UI_MAX_ROWS
  const llmStruct = llmOptionalToursToStructured(args.llmRows)
  if (llmStruct.sourceCount > cap) {
    issues.push({
      field: 'optionalToursStructured',
      reason: `선택관광 행이 ${llmStruct.sourceCount}개로 감지되어 상한 ${cap}개까지만 구조화했습니다.`,
      source: 'llm',
      severity: 'warn',
    })
  }
  const llmJson = llmStruct.rows.length > 0 ? JSON.stringify(llmStruct.rows) : null

  const primarySource =
    jsonArrayNonEmpty(args.signalsJson) ? args.signalsJson : jsonArrayNonEmpty(args.lineRegexJson) ? args.lineRegexJson : null

  if (primarySource) {
    const capped = capJsonArrayLength(primarySource, cap)
    if (capped.capped) {
      issues.push({
        field: 'optionalToursStructured',
        reason: `선택관광 행이 ${capped.originalLen}개로 감지되어 상한 ${cap}개까지만 저장합니다.`,
        source: 'auto',
        severity: 'warn',
      })
    }
    const finalJson = capped.json
    if (llmJson && finalJson) {
      const sigFp = fingerprintOptionalLikeJson(finalJson)
      const llmFp = fingerprintOptionalLikeJson(llmJson)
      let primaryCount = 0
      try {
        const a = JSON.parse(finalJson) as unknown[]
        primaryCount = Array.isArray(a) ? a.length : 0
      } catch {
        primaryCount = 0
      }
      if (sigFp !== llmFp && sigFp.length > 0) {
        issues.push({
          field: 'optionalToursStructured',
          reason: `표/regex 추출과 Gemini 선택관광 표가 불일치합니다. 저장·미리보기는 표/regex 우선(${primaryCount}행). LLM은 보조 필드(optionalToursLlmSupplementJson)에 보존.`,
          source: 'auto',
          severity: 'warn',
        })
      } else if (primaryCount !== llmStruct.rows.length) {
        issues.push({
          field: 'optionalToursStructured',
          reason: `표/regex 추출 ${primaryCount}행, Gemini ${llmStruct.rows.length}행 — 행 수가 다릅니다. 저장은 표/regex 우선.`,
          source: 'auto',
          severity: 'warn',
        })
      }
    }
    return {
      final: sanitizeOptionalToursStructuredJson(finalJson),
      llmSupplement: sanitizeOptionalToursStructuredJson(llmJson),
      issues,
    }
  }

  if (llmJson) {
    const capped = capJsonArrayLength(llmJson, cap)
    if (capped.capped) {
      issues.push({
        field: 'optionalToursStructured',
        reason: `선택관광 행이 ${capped.originalLen}개로 감지되어 상한 ${cap}개까지만 저장합니다.`,
        source: 'llm',
        severity: 'warn',
      })
    }
    return { final: sanitizeOptionalToursStructuredJson(capped.json), llmSupplement: null, issues }
  }

  return { final: null, llmSupplement: null, issues }
}

function mergeShoppingStopsJson(args: {
  llmRows: Array<Record<string, unknown>> | undefined
  signalsJson: string | null
}): { final: string | null; llmSupplement: string | null; issues: RegisterExtractionFieldIssue[] } {
  const issues: RegisterExtractionFieldIssue[] = []
  const llmStruct = llmShoppingToStructured(args.llmRows)
  if (llmStruct.sourceCount > MAX_SHOPPING_STOPS) {
    issues.push({
      field: 'shoppingStops',
      reason: `쇼핑 행이 ${llmStruct.sourceCount}개로 감지되어 상한 ${MAX_SHOPPING_STOPS}개까지만 구조화했습니다.`,
      source: 'llm',
      severity: 'warn',
    })
  }
  const llmJson = llmStruct.rows.length > 0 ? JSON.stringify(llmStruct.rows) : null

  if (jsonArrayNonEmpty(args.signalsJson)) {
    const finalJson = args.signalsJson as string
    if (llmJson) {
      const sigFp = fingerprintOptionalLikeJson(finalJson)
      const llmFp = fingerprintOptionalLikeJson(llmJson)
      let primaryCount = 0
      try {
        const a = JSON.parse(finalJson) as unknown[]
        primaryCount = Array.isArray(a) ? a.length : 0
      } catch {
        primaryCount = 0
      }
      if (sigFp !== llmFp && sigFp.length > 0) {
        issues.push({
          field: 'shoppingStops',
          reason: `쇼핑 표/regex와 Gemini 쇼핑 표가 불일치합니다. 저장은 표/regex 우선(${primaryCount}행). LLM은 보조 필드(shoppingStopsLlmSupplementJson)에 보존.`,
          source: 'auto',
          severity: 'warn',
        })
      } else if (primaryCount !== llmStruct.rows.length) {
        issues.push({
          field: 'shoppingStops',
          reason: `쇼핑 표/regex ${primaryCount}행, Gemini ${llmStruct.rows.length}행 — 행 수가 다릅니다. 저장은 표/regex 우선.`,
          source: 'auto',
          severity: 'warn',
        })
      }
    }
    try {
      const arr = JSON.parse(finalJson) as unknown[]
      if (Array.isArray(arr) && arr.length > MAX_SHOPPING_STOPS) {
        issues.push({
          field: 'shoppingStops',
          reason: `쇼핑 행이 ${arr.length}개로 감지되어 상한 ${MAX_SHOPPING_STOPS}개까지만 저장합니다.`,
          source: 'auto',
          severity: 'warn',
        })
      }
    } catch {
      // ignore
    }
    return { final: finalJson, llmSupplement: llmJson, issues }
  }

  if (llmJson) {
    const capped = capJsonArrayLength(llmJson, MAX_SHOPPING_STOPS)
    if (capped.capped) {
      issues.push({
        field: 'shoppingStops',
        reason: `쇼핑 행이 ${capped.originalLen}개로 감지되어 상한 ${MAX_SHOPPING_STOPS}개까지만 저장합니다.`,
        source: 'llm',
        severity: 'warn',
      })
    }
    return { final: capped.json, llmSupplement: null, issues }
  }

  return { final: null, llmSupplement: null, issues }
}

function parseLlmExtractionFieldIssues(raw: unknown): RegisterExtractionFieldIssue[] {
  if (!Array.isArray(raw)) return []
  const out: RegisterExtractionFieldIssue[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const o = x as Record<string, unknown>
    const field = String(o.field ?? '').trim()
    const reason = String(o.reason ?? '').trim()
    if (!field || !reason) continue
    const source =
      o.source === 'manual' || o.source === 'llm' || o.source === 'auto' ? o.source : 'llm'
    const severity = o.severity === 'warn' || o.severity === 'info' ? o.severity : 'info'
    out.push({ field, reason, source, severity })
  }
  return out
}

/**
 * 일정 본문에서만 보조 추출(LLM이 비웠을 때). 원문 패턴이 있을 때만 채움(환각 금지).
 */
function extractMealHotelFromDayText(text: string): Partial<RegisterScheduleDay> {
  const out: Partial<RegisterScheduleDay> = {}
  const t = text.replace(/\r/g, '')
  const triplet = t.match(
    /(?:조식|아침)\s*[-:：/／]\s*([^/|]+?)\s*[/|／]\s*(?:중식|점심)\s*[-:：]?\s*([^/|]+?)\s*[/|／]\s*(?:석식|저녁)\s*[-:：]?\s*([^/|]+)/i
  )
  if (triplet) {
    const a = triplet[1]?.trim()
    const b = triplet[2]?.trim()
    const c = triplet[3]?.trim()
    if (a) out.breakfastText = a.slice(0, 200)
    if (b) out.lunchText = b.slice(0, 200)
    if (c) out.dinnerText = c.slice(0, 200)
    return out
  }
  const bp = t.match(/(?:조식|아침)\s*[-:：]\s*([^\n]+)/i)
  const lp = t.match(/(?:중식|점심)\s*[-:：]\s*([^\n]+)/i)
  const dp = t.match(/(?:석식|저녁)\s*[-:：]\s*([^\n]+)/i)
  if (bp?.[1]) out.breakfastText = bp[1].trim().slice(0, 200)
  if (lp?.[1]) out.lunchText = lp[1].trim().slice(0, 200)
  if (dp?.[1]) out.dinnerText = dp[1].trim().slice(0, 200)
  const hp = t.match(
    /(?:예정\s*호텔|예정숙소|숙소|숙박|투숙|호텔|리조트|콘도)\s*[:：]\s*([^\n]+)/i
  )
  if (hp?.[1]) out.hotelText = hp[1].trim().slice(0, 500)
  if (Object.keys(out).length) return out
  const mealOnly = t.match(/식사\s*[:：]\s*([^\n]+)/i)
  if (mealOnly?.[1]?.trim()) {
    out.mealSummaryText = mealOnly[1].trim().slice(0, 500)
  }
  return out
}

function supplementScheduleDayFromDescription(row: RegisterScheduleDay): RegisterScheduleDay {
  const has =
    (row.hotelText?.trim() ?? '') ||
    (row.breakfastText?.trim() ?? '') ||
    (row.lunchText?.trim() ?? '') ||
    (row.dinnerText?.trim() ?? '') ||
    (row.mealSummaryText?.trim() ?? '')
  if (has) return row
  const ex = extractMealHotelFromDayText(`${row.title}\n${row.description}`)
  if (!ex || Object.keys(ex).length === 0) return row
  return { ...row, ...ex }
}

function mergeAirtelHotelJsonWithLlm(
  baseJson: string | null,
  llm: {
    hotelInfoRaw?: string | null
    hotelNames?: string[]
    hotelStatusText?: string | null
    hotelNoticeRaw?: string | null
  }
): string | null {
  const hasLlm =
    Boolean(llm.hotelInfoRaw?.trim()) ||
    (llm.hotelNames?.length ?? 0) > 0 ||
    Boolean(llm.hotelStatusText?.trim()) ||
    Boolean(llm.hotelNoticeRaw?.trim())
  if (!hasLlm) return baseJson
  let base: Record<string, unknown> = {}
  if (baseJson?.trim()) {
    try {
      const o = JSON.parse(baseJson) as unknown
      if (o && typeof o === 'object' && !Array.isArray(o)) base = o as Record<string, unknown>
    } catch {
      base = {}
    }
  }
  if (llm.hotelNames?.length) base.llmHotelNames = llm.hotelNames
  if (llm.hotelInfoRaw?.trim()) base.hotelInfoRaw = llm.hotelInfoRaw.trim()
  if (llm.hotelStatusText?.trim()) base.hotelStatusText = llm.hotelStatusText.trim()
  if (llm.hotelNoticeRaw?.trim()) base.hotelNoticeRaw = llm.hotelNoticeRaw.trim()
  return JSON.stringify(base)
}

function applyProductLevelFlightMeeting(
  raw: Record<string, unknown>,
  rows: ParsedProductPrice[]
): ParsedProductPrice[] {
  if (!rows.length) return rows
  // 상품 단위 항공/미팅을 다중 출발행의 첫 행에 강제로 주입하면 SSOT가 왜곡된다.
  // 단일 행일 때만 제한적으로 보완한다.
  if (rows.length > 1) return rows
  const airlineName = strOrNull(raw.airlineName) ?? strOrNull(raw.airline)
  const first = rows[0]
  const patch: Partial<ParsedProductPrice> = {}
  if (airlineName && !first.carrierName) patch.carrierName = airlineName
  if (strOrNull(raw.outboundFlightNo) && !first.outboundFlightNo)
    patch.outboundFlightNo = strOrNull(raw.outboundFlightNo) ?? undefined
  if (strOrNull(raw.inboundFlightNo) && !first.inboundFlightNo)
    patch.inboundFlightNo = strOrNull(raw.inboundFlightNo) ?? undefined
  if (strOrNull(raw.meetingInfoRaw) && !first.meetingInfoRaw)
    patch.meetingInfoRaw = strOrNull(raw.meetingInfoRaw) ?? undefined
  if (strOrNull(raw.meetingPlaceRaw) && !first.meetingPointRaw)
    patch.meetingPointRaw = strOrNull(raw.meetingPlaceRaw) ?? undefined
  if (strOrNull(raw.meetingNoticeRaw) && !first.meetingGuideNoticeRaw)
    patch.meetingGuideNoticeRaw = strOrNull(raw.meetingNoticeRaw) ?? undefined
  if (Object.keys(patch).length === 0) return rows
  return [{ ...first, ...patch }, ...rows.slice(1)]
}

const REGISTER_PROMPT = `${REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO}

${REGISTER_PROMPT_SCHEDULE_FIELDS_SUPPLIER_ONLY_BLOCK}

${BONGTOUR_TONE_MANNER_LLM_BLOCK}

${LLM_JSON_OUTPUT_DISCIPLINE_BLOCK}

# [추출 SSOT — 절대 약화 금지]
- 일반 본문 "요약"으로 표·리스트·항공·미팅·가격표를 대체하지 말 것. 구조화해야 할 블록은 반드시 해당 JSON 필드에 넣을 것.
- 입력은 오직 관리자가 붙여넣은 블록뿐이다: [PASTED SUPPLIER BODY], [PASTED PRICE TABLE], [PASTED AIRLINE OR TRANSPORT INFO], [PASTED OPTIONAL TOUR], [PASTED SHOPPING INFO], [PASTED INCLUDED / EXCLUDED], [PASTED HOTEL INFO], [PASTED REQUIRED CHECKS], [IMAGE FILE NAMES AND SPOT LABELS]. URL·외부 HTML·어댑터 수집은 없다.
- 우선순위: (1) [PASTED PRICE TABLE] > 본문 가격표 (2) 표/리스트 > 산문 (3) [PASTED AIRLINE OR TRANSPORT INFO] (4) 선택관광·쇼핑 표 (5) 충돌 시 fieldIssues에 남기고 raw는 보존.
- 상품 본문 가격표(연령별 단가)와 우측 견적 카드 총액·상단 프로모를 혼동하지 말 것. priceTableRawText·productPriceTable은 본문 표 SSOT.
- 선택관광: optionalTourNoticeRaw / optionalTourNoticeItems 는 안내문만. optionalTours[] 는 표 행만(안내문 번호 문장을 행에 넣지 말 것). "진행 여부 확인" 같은 문구를 모든 행에 기계적으로 복제하지 말 것.
- 쇼핑: shoppingNoticeRaw + shoppingStops[] 표 행 분리.
- 포함/불포함: includedItems[]·excludedItems[] 구분. 전체 덤프는 includedRaw·excludedRaw·includedExcludedRaw에 보존 가능.
- 1인실 추가요금(싱글차지/독실사용료)은 반드시 불포함사항으로 처리한다. singleRoomSurcharge* 필드에 구조화하고, excludedItems[]에 반영한다. singleRoomSurchargeDisplayText는 **한 줄만**(항목명과 금액을 같은 줄에, 줄바꿈으로 금액 분리 금지). 금액이 있으면 예: 「1인실 객실 추가요금 200,000원」 형태를 우선한다.
- 미팅: meetingPlaceRaw·meetingNoticeRaw·meetingFallbackText. 상세 없으면 meetingFallbackText는 "미팅장소는 상담 시 확인하여 안내드리겠습니다."를 사용.
- 꼭 확인하세요: mustKnowItems[]/mustKnowRaw 는 **공급사 원문([PASTED REQUIRED CHECKS]·본문 해당 구간) 우선** 구조화. 상담 키워드/불포함/보험/유류/현지경비 반복 금지.
  - 포함/불포함/선택관광 안내문을 재탕하지 말 것.
  - 원문에 해당 정보가 없으면 mustKnowItems는 비우거나 최소화. **검색·외부 사실 보완은 이 API 호출에서 하지 말 것**(서버 후처리).
  - mustKnowSource: 공급사 원문만 구조화했으면 "supplier".
- 애매하면 값을 버리지 말고 fieldIssues에 { field, reason, source:"llm", severity:"info"|"warn" } 로 남길 것.

# [destination·일정·항공 — fieldIssues 작성 시]
- destination 은 상품 카드·검색용 **대표 목적지/권역/도시**일 수 있으며, 항공 **첫 입국(가는편 도착)** 도시와 같아야 한다고 가정하지 말 것. 패키지는 A(출발)→B(입국) 후 여러 도시 경유, C(현지 출국)→A(귀국) **오픈조·다도시**가 흔함.
- **요약 여정(제목·대표 목적지)과 일차별 일정표·항공 첫 도착/마지막 출발이 문자상 다르더라도 즉시 "오류"로 단정하지 말 것.** 검수 참고용으로만 severity는 기본 **info**를 우선한다.
- 목적지 관련 fieldIssues 를 넣을 때 구분 권장: (1) field "destination.representative_vs_first_arrival" — 대표 목적지 vs 항공 첫 도착 (2) "destination.schedule_day1_vs_first_arrival" — 1일차 일정 텍스트 vs 항공 첫 도착 (3) "destination.representative_vs_final_departure" — 대표 목적지 vs 귀국편 출발(현지 마지막 출국). 각 reason 에 오픈조·다도시 가능성을 한 문장 포함할 것.
- 일정표 day 흐름과 항공 구간이 서로 맞는 것으로 보이면, 대표 destination 문자만 다르다고 **warn 금지**(info 또는 생략).

# [입력 블록 — 의미]
- [PASTED SUPPLIER BODY]: 관리자 복붙 전체(필수).
- 각 [PASTED …] 블록: 서버가 본문에서 분리했거나 관리자가 별도 입력한 구간. 표가 있으면 가격표 블록을 최우선.
- 본문에 이미지 URL/이미지 파일명/캡션/IMG 태그가 있어도 이미지 source로 사용하지 말고 무시한다. 대표/목록/히어로 이미지는 이 파싱 결과로 생성하지 않는다.

# [추출 필드 - 강제]
- originCode, title, destination, duration, schedule[], prices[] (달력 행)
- 상품가격표 원문: priceTableRawText, priceTableRawHtml(있을 때), productPriceTable: adultPrice, childExtraBedPrice, childNoBedPrice, infantPrice (본문 표에서만; 없으면 null). **infantPrice**: "유아/소아(만 2세 미만)/INFANT/유아 요금" 등과 같은 줄·인접 줄의 원 단위 숫자를 반드시 구조화한다.
- 항공(상품/구간 요약): airlineName, departureSegmentText, returnSegmentText, outboundFlightNo, inboundFlightNo, departureDateTimeRaw, arrivalDateTimeRaw, routeRaw — 항공사를 태그 한 줄에만 묻지 말고 필드로 분리.
- 미팅(상품 단위): meetingInfoRaw, meetingPlaceRaw, meetingNoticeRaw, meetingFallbackText
- 선택관광: optionalTourNoticeRaw, optionalTourNoticeItems[], optionalTours[], hasOptionalTour, optionalTourCount, optionalTourSummaryText
- 쇼핑: hasShopping, shoppingVisitCount, shoppingSummaryText, shoppingNoticeRaw, shoppingStops[]
- 자유시간: hasFreeTime, freeTimeRawMentions, freeTimeSummaryText
- 포함/불포함: includedItems[], excludedItems[], includedRaw, excludedRaw, includedExcludedRaw, includedText, excludedText
- 호텔(상품): hotelInfoRaw, hotelNames[], hotelSummaryText(전체 요약 한 줄, 예: 대표호텔명 외 1), hotelStatusText, hotelNoticeRaw — 원문·[PASTED HOTEL INFO] 근거만. 없으면 null.
- 일차별 예정호텔: dayHotelPlans[] — 본문에 「1일차 예정호텔」「2일차 예정호텔」처럼 일정별 블록이 있으면 **반드시** dayIndex·label·hotels[]로 분리한다. 한 줄에 호텔명만 나열해 hotelNames에만 넣지 말 것(중복 허용 시 dayHotelPlans 우선). 각 항목: dayIndex(1부터), label(예: 1일차 예정호텔), hotels(해당 일 숙박 후보·복수면 배열), raw(해당 블록 원문 한 덩어리, 선택).
- 일정 일차별 숙소·식사: schedule[] 각 항목에 hotelText(해당 일 예정 호텔/숙소 한 줄), breakfastText, lunchText, dinnerText, mealSummaryText(원문 식사 줄 전체 보존). 상품 전체 호텔과 일차 호텔은 구분. 식사를 조·중·석으로 나눌 수 없으면 mealSummaryText만 채우고 나머지 null. 창작·추론 금지.
- 꼭 확인하세요: mustKnowItems[{category,title,body}], mustKnowRaw (3~6개, 1~2줄씩), mustKnowSource ("supplier"), mustKnowNoticeRaw (null)

# [달력 데이터 정밀 추출]
- 패턴 인식: 텍스트에서 [날짜/요일/가격/상태]가 반복되는 구간을 '달력 그리드'로 인식하라.
- 날짜 정규화: '26.04.17(금)', '26-04-17' 등은 반드시 '2026-04-17' 표준 포맷으로 변환하라.
- 가격 매핑: 성인 가격(adultPrice 또는 adultBase+adultFuel)을 숫자로 추출하고, 해당 날짜의 예약 상태(status)를 1:1로 매핑하여 prices 배열에 넣어라.
- 주관 배제: 텍스트에 없는 날짜를 생성하지 말고, 오직 로그에 존재하는 데이터만 팩트대로 추출하라.

# [schedule] 일차별 (필수)
- day, title, description, imageKeyword
- description: 해당 일차 블록 전체를 근거로 관광·이동·식사·숙박을 **빠짐없이** 반영한 문어체 존댓말 요약. **3~6문장·450자 이내**를 목표로 하며, 한 줄·한두 문장만 쓰지 말 것. 복수 관광지가 있으면 모두 짧게라도 언급.
- imageKeyword: 해당 일차의 실존하는 장소 이름만 사용 (창조·추상 금지). 영문 명사 (예: Osaka Castle, Taipei 101)
- 선택(원문에 있을 때만): hotelText, breakfastText, lunchText, dinnerText, mealSummaryText — 공급사 일정표 문구 유지. 불확실하면 mealSummaryText에만 원문 보존.

# [prices] 출발일별 요금 (달력과 동일한 날짜만)
date(YYYY-MM-DD), adultBase, adultFuel, childBedBase, childNoBedBase, childFuel, infantBase, infantFuel, status, availableSeats
# [선택] 출발일별 항공·미팅 — prices[] 각 행에 넣을 때 (필드명은 DB와 동일: *Airport 키이나 값은 도시명·공항명 모두 허용. outboundDeparturePlace 등과 동일 의미)
- 가는편·오는편 각각 **하나의 항공 블록**으로 취급한다. 항공사명이 있고 출발/도착 시각이 잡히면, **같은 블록·인접 줄**에서 출발지·도착지(도시 또는 공항)를 반드시 outboundDepartureAirport, outboundArrivalAirport, inboundDepartureAirport, inboundArrivalAirport에 구조화한다.
- [PASTED AIRLINE OR TRANSPORT INFO]·본문의 "가는편/오는편"·"출국/입국" 구간을 우선한다. **시각(날짜+시각) 쌍이 있으면 그 줄의 앞뒤 2~3줄·동일 줄에서 도시/공항명을 재탐색**한다. 시간만 추출하고 장소가 비면 fieldIssues에 { field, reason, severity:"warn", source:"llm" }로 남긴다.
- 원문에 장소가 없을 때만 해당 필드를 null로 둔다(빈 문자열 금지). "확인중" 같은 placeholder 출력 금지.
- carrierName, outboundFlightNo, outboundDepartureAirport, outboundDepartureAt, outboundArrivalAirport, outboundArrivalAt, inboundFlightNo, inboundDepartureAirport, inboundDepartureAt, inboundArrivalAirport, inboundArrivalAt, meetingInfoRaw, meetingPointRaw, meetingTerminalRaw, meetingGuideNoticeRaw (시각은 ISO 또는 YYYY-MM-DD HH:mm)

# [pricePromotion] 상단 요금·할인·혜택·쿠폰 블록 (선택, 반드시 채울 것)
- 본문·수동 보조 블록에 기준가/할인가/절약/쿠폰/혜택 문구가 있으면 객체 pricePromotion으로 분리해 출력한다.
- 텍스트에 취소선이 없어도 "889000원 829000원"처럼 두 금액이 나란히 있으면 보통 큰 값=기준가(basePrice), 작은 값=현재가(salePrice)로 추정한다. 확신 없으면 null.
- 마케팅 문구는 원문을 savingsText, couponText, benefitTitle 등에 보존한다. 확정 약속으로 서술하지 말 것.
- priceDisplayRaw: 상단 가격 영역을 한 줄~수줄로 요약한 원문. benefitRawText: 혜택·쿠폰 구간 원문.
- strikeThroughDetected: 입력 텍스트/HTML 조각에 취소선·<del>·<s>·line-through 언급이 있으면 true.

응답은 반드시 아래 JSON만 출력. 설명·마크다운·자연어 없이 JSON만.

{
  "originSource": "string",
  "originCode": "string",
  "title": "string",
  "destination": "string",
  "duration": "string",
  "airline": "string or null",
  "airlineName": "string or null",
  "departureSegmentText": "string or null",
  "returnSegmentText": "string or null",
  "outboundFlightNo": "string or null",
  "inboundFlightNo": "string or null",
  "departureDateTimeRaw": "string or null",
  "arrivalDateTimeRaw": "string or null",
  "routeRaw": "string or null",
  "isFuelIncluded": true,
  "isGuideFeeIncluded": false,
  "mandatoryLocalFee": null,
  "mandatoryCurrency": null,
  "priceTableRawText": "string or null",
  "priceTableRawHtml": "string or null",
  "productPriceTable": {
    "adultPrice": null,
    "childExtraBedPrice": null,
    "childNoBedPrice": null,
    "infantPrice": null
  },
  "includedItems": ["string"],
  "excludedItems": ["string"],
  "includedRaw": "string or null",
  "excludedRaw": "string or null",
  "includedExcludedRaw": "string or null",
  "includedText": "string or null",
  "excludedText": "string or null",
  "singleRoomSurchargeAmount": null,
  "singleRoomSurchargeCurrency": "KRW or null",
  "singleRoomSurchargeRaw": "string or null",
  "singleRoomSurchargeDisplayText": "string or null",
  "hasSingleRoomSurcharge": false,
  "criticalExclusions": "string or null",
  "hotelInfoRaw": "string or null",
  "hotelNames": ["string"],
  "dayHotelPlans": [
    { "dayIndex": 1, "label": "1일차 예정호텔", "hotels": ["호텔A", "호텔B"], "raw": "string or null" }
  ],
  "hotelSummaryText": "string or null",
  "hotelStatusText": "string or null",
  "hotelNoticeRaw": "string or null",
  "meetingInfoRaw": "string or null",
  "meetingPlaceRaw": "string or null",
  "meetingNoticeRaw": "string or null",
  "meetingFallbackText": "string or null",
  "optionalTourNoticeRaw": "string or null",
  "optionalTourNoticeItems": ["string"],
  "optionalTourDisplayNoticeFinal": "string or null",
  "hasOptionalTour": false,
  "optionalTourCount": 0,
  "optionalTourSummaryText": "string",
  "optionalTours": [
    {
      "name": "string",
      "currency": "string or null",
      "adultPrice": 0,
      "childPrice": 0,
      "durationText": "string or null",
      "minPaxText": "string or null",
      "guide同行Text": "string or null",
      "waitingPlaceText": "string or null",
      "raw": "string"
    }
  ],
  "hasShopping": false,
  "shoppingNoticeRaw": "string or null",
  "shoppingVisitCount": 0,
  "shoppingSummaryText": "string",
  "shoppingStops": [
    {
      "itemType": "string",
      "placeName": "string",
      "durationText": "string or null",
      "refundPolicyText": "string or null",
      "raw": "string"
    }
  ],
  "hasFreeTime": false,
  "freeTimeRawMentions": ["string"],
  "freeTimeSummaryText": "string",
  "fieldIssues": [
    { "field": "string", "reason": "string", "source": "llm", "severity": "info" }
  ],
  "mustKnowRaw": "string or null",
  "mustKnowSource": "supplier",
  "mustKnowNoticeRaw": "string or null",
  "mustKnowItems": [
    { "category": "입국/비자|자녀동반|현지준비|안전/유의|국내준비|집결/탑승", "title": "string", "body": "string", "raw": "string" }
  ],
  "pricePromotion": {
    "basePrice": null,
    "salePrice": null,
    "savingsText": null,
    "benefitTitle": null,
    "couponAvailable": null,
    "couponText": null,
    "couponCtaText": null,
    "priceDisplayRaw": null,
    "benefitRawText": null,
    "benefitRawHtml": null,
    "strikeThroughDetected": null
  },
  "schedule": [
    {
      "day": 1,
      "title": "",
      "description": "",
      "imageKeyword": "Real place name in English",
      "hotelText": null,
      "breakfastText": null,
      "lunchText": null,
      "dinnerText": null,
      "mealSummaryText": null
    }
  ],
  "prices": [
    { "date": "YYYY-MM-DD", "adultBase": 0, "adultFuel": 0, "childBedBase": null, "childNoBedBase": null, "childFuel": 0, "infantBase": null, "infantFuel": 0, "status": "예약가능", "availableSeats": 0 }
  ]
}`

/**
 * 미리보기 전용: 전체 등록 JSON을 요구하지 않음. 출력은 소형 스키마만(잘림 방지).
 * confirm 경로는 `REGISTER_PROMPT` 유지.
 */
const REGISTER_PREVIEW_MINIMAL_PROMPT = `${REGISTER_PREVIEW_MINIMAL_TONE_BLOCK}

# Role: 등록 미리보기 — 초경량 메타 JSON만

# 규칙
- 설명·마크다운·코드펜스 없이 JSON 객체 하나만. 마지막 비공백 문자는 닫는 }.
- 키는 아래 예시만 사용. 값은 짧게. **토큰을 아끼기 위해 서술·배열 남발 금지.**

# 절대 출력 금지 (잘림·불필요 — 확정 파싱·서버가 처리)
- summary, mustKnowItems, mustKnowRaw, counselingNotes, criticalExclusions
- pricePromotion 및 혜택·쿠폰 전부
- hasFreeTime, freeTimeRawMentions, freeTimeSummaryText
- meetingPlaceRaw, meetingNoticeRaw, meetingFallbackText, meetingInfoRaw
- schedule[], prices[], optionalTours[], shoppingStops[] 및 표·달력·장문 raw

# 채울 필드만 (본문·꼭 확인 구간 근거)
- originSource, originCode, title, destination, duration(예: 3박 4일, 없으면 null)
- airlineName: 한 줄 또는 null
- hasOptionalTour (bool), optionalTourCount (숫자 또는 null)
- hasShopping (bool), shoppingSummaryText: 짧은 쇼핑 요약만 또는 null
- hotelSummaryText: 없으면 null, 있으면 80자 이내
- fieldIssues: { field, reason, source:"llm", severity:"info"|"warn" } **최대 3건**. reason 각 120자 이내. 목적지·일정 힌트만.

{
  "originSource": "string",
  "originCode": "string",
  "title": "string",
  "destination": "string",
  "duration": null,
  "airlineName": null,
  "hasOptionalTour": false,
  "optionalTourCount": null,
  "hasShopping": false,
  "shoppingSummaryText": null,
  "hotelSummaryText": null,
  "fieldIssues": []
}`

function isEmptyRegisterPreviewSlot(v: unknown): boolean {
  if (v == null) return true
  if (typeof v === 'string') return !v.trim()
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') return Object.keys(v as object).length === 0
  return false
}

function mergePreviewDeterministicWithLlm(
  deterministic: Partial<RegisterGeminiLlmJson>,
  llm: Record<string, unknown>
): RegisterGeminiLlmJson {
  const merged: Record<string, unknown> = { ...llm }
  for (const [key, detVal] of Object.entries(deterministic)) {
    if (detVal === undefined) continue
    if (!isEmptyRegisterPreviewSlot(detVal)) merged[key] = detVal
  }
  return merged as RegisterGeminiLlmJson
}

/** 미리보기: 서술형·장문 키 제거·표 고정(LLM이 넘겨도 무시) */
function finalizePreviewRegisterRaw(raw: RegisterGeminiLlmJson): RegisterGeminiLlmJson {
  const rec = raw as Record<string, unknown>
  delete rec.optionalTours
  delete rec.shoppingStops
  delete rec.summary
  delete rec.mustKnowItems
  delete rec.mustKnowRaw
  delete rec.counselingNotes
  delete rec.criticalExclusions
  delete rec.pricePromotion
  delete rec.hasFreeTime
  delete rec.freeTimeRawMentions
  delete rec.freeTimeSummaryText
  delete rec.meetingPlaceRaw
  delete rec.meetingNoticeRaw
  delete rec.meetingFallbackText
  delete rec.meetingInfoRaw
  raw.prices = []
  raw.schedule = []
  if (Array.isArray(raw.fieldIssues)) {
    const cap = 3
    const maxReason = 120
    raw.fieldIssues = (raw.fieldIssues as unknown[])
      .filter((x) => x && typeof x === 'object' && !Array.isArray(x))
      .slice(0, cap)
      .map((x) => {
        const o = x as Record<string, unknown>
        const reason = typeof o.reason === 'string' ? o.reason.trim().slice(0, maxReason) : o.reason
        return { ...o, reason }
      })
  }
  if (typeof rec.hotelSummaryText === 'string' && rec.hotelSummaryText.length > 120) {
    rec.hotelSummaryText = `${String(rec.hotelSummaryText).slice(0, 117)}…`
  }
  if (typeof rec.shoppingSummaryText === 'string' && rec.shoppingSummaryText.length > 120) {
    rec.shoppingSummaryText = `${String(rec.shoppingSummaryText).slice(0, 117)}…`
  }
  return raw
}

function extractDurationLineFromPaste(blob: string): string | null {
  const m = blob.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return null
  return `${m[1]}박 ${m[2]}일`
}

function buildPreviewDeterministicRegisterRaw(args: {
  detailBody: DetailBodyParseSnapshot
  blockB: string
  pastedHotel: string | null
  originSource: string
  brandKey: string | null
  originUrl: string | null
  resolveDirectedLines: DirectedFlightLineResolver
}): Partial<RegisterGeminiLlmJson> {
  const { detailBody, blockB, pastedHotel, originSource, brandKey, originUrl, resolveDirectedLines } = args
  const ie = detailBody.includedExcludedStructured
  const out: Partial<RegisterGeminiLlmJson> = {
    prices: [],
    schedule: [],
    originSource: normalizeOriginSource(originSource, brandKey),
  }

  if (ie.includedItems.length) out.includedItems = [...ie.includedItems]
  if (ie.excludedItems.length) out.excludedItems = [...ie.excludedItems]

  const hotelRows = detailBody.hotelStructured.rows
  if (hotelRows.length) {
    const names = hotelRows.map((r) => r.hotelNameText).filter(Boolean)
    if (names.length) {
      out.hotelNames = names
      out.hotelInfoRaw = hotelRows
        .map((r) => [r.dayLabel, r.dateText, r.hotelNameText].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('\n')
      out.hotelSummaryText = names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}`
    }
  }

  const optCount = detailBody.optionalToursStructured.rows.length
  if (optCount > 0) {
    out.hasOptionalTour = true
    out.optionalTourCount = optCount
    out.optionalTourSummaryText = optCount > 1 ? `현지옵션 ${optCount}개` : '현지옵션 있음'
  }

  const shopStructured = detailBody.shoppingStructured
  const shopRowCount = shopStructured.rows.length
  const shopCountText = shopStructured.shoppingCountText?.trim()
  if (shopRowCount > 0 || shopCountText) {
    out.hasShopping = true
    out.shoppingSummaryText = shopCountText || (shopRowCount > 0 ? `쇼핑 ${shopRowCount}회` : null)
  }

  const dur = extractDurationLineFromPaste(blockB)
  if (dur) out.duration = dur

  const plansBlob = [pastedHotel, out.hotelInfoRaw, blockB]
    .filter((x): x is string => Boolean(x && String(x).trim()))
    .join('\n\n')
  const parsedPlans = parseDayHotelPlansFromSupplierText(plansBlob)
  if (parsedPlans.length) {
    out.dayHotelPlans = parsedPlans.map((p) => ({
      dayIndex: p.dayIndex,
      label: p.label,
      hotels: p.hotels,
      raw: p.raw ?? null,
    }))
  }

  const obLeg = detailBody.flightStructured.outbound
  const ibLeg = detailBody.flightStructured.inbound

  const { departureSegmentFromStructured, returnSegmentFromStructured } = resolveDirectedLines(detailBody)

  const airName = detailBody.flightStructured.airlineName
  if (airName) out.airlineName = airName
  if (obLeg.flightNo) out.outboundFlightNo = obLeg.flightNo
  if (ibLeg.flightNo) out.inboundFlightNo = ibLeg.flightNo
  if (departureSegmentFromStructured) out.departureSegmentText = departureSegmentFromStructured
  if (returnSegmentFromStructured) out.returnSegmentText = returnSegmentFromStructured

  return out
}

export async function parseForRegisterLlmYbtour(
  rawText: string,
  originSource: string = '직접입력',
  options?: RegisterLlmParseOptionsCommon
): Promise<RegisterParsed> {
  const resolveLines: DirectedFlightLineResolver =
    options?.resolveDirectedFlightLines ?? resolveDirectedFlightLinesDefault

  if (!options?.presetDetailBody) {
    throw new Error(
      'parseForRegisterLlmYbtour: presetDetailBody가 필요합니다. register-parse-ybtour 및 전용 /api/travel/parse-and-register-* 만 사용하세요.'
    )
  }
  let detailBody: DetailBodyParseSnapshot = options.presetDetailBody
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  options?.onTiming?.('before-section-repairs')
  const tSectionRepairs = Date.now()
  // Section-level Gemini repair chain: required/warning 정책에 따른 조건부 보정
  const maxSectionRepairs = Math.max(0, options?.maxDetailSectionRepairs ?? 3)
  let sectionRepairsUsed = 0
  if (!options?.skipDetailSectionGeminiRepairs) {
    const sectionByType = new Map(detailBody.sections.map((s) => [s.type, s.text]))
    const repairPlan = decideSectionRepairPolicy(detailBody)
    const repairLog: NonNullable<DetailBodyParseSnapshot['geminiRepairLog']> = {}
    for (const plan of repairPlan) {
      const target = plan.section
      repairLog[target] = {
        mode: plan.mode,
        triggered: false,
        applied: false,
        reason: plan.reason,
      }
      if (plan.mode === 'skip') continue
      if (
        (target === 'hotel_section' && !!options?.pastedBlocks?.hotel?.trim()) ||
        (target === 'flight_section' && !!options?.pastedBlocks?.airlineTransport?.trim()) ||
        (target === 'optional_tour_section' && !!options?.pastedBlocks?.optionalTour?.trim()) ||
        (target === 'shopping_section' && !!options?.pastedBlocks?.shopping?.trim())
      ) {
        repairLog[target] = {
          ...repairLog[target]!,
          triggered: false,
          applied: false,
          reason: '별도 입력 우선 적용 섹션이라 Gemini repair 생략',
        }
        continue
      }
      const sectionText = sectionByType.get(target) ?? ''
      if (!sectionText.trim()) continue
      if (sectionRepairsUsed >= maxSectionRepairs) {
        repairLog[target] = {
          ...repairLog[target]!,
          triggered: false,
          applied: false,
          reason: `${plan.reason} (섹션 repair 상한 ${maxSectionRepairs}회 도달)`,
        }
        continue
      }
      repairLog[target] = { ...repairLog[target]!, triggered: true }
      if (options?.llmCallMetrics) options.llmCallMetrics.sectionRepairLlm += 1
      sectionRepairsUsed += 1
      const repaired = await runDetailSectionGeminiRepair(model, target, sectionText)
      if (!repaired) continue
      if (target === 'hotel_section' && Array.isArray(repaired.rows) && repaired.rows.length > 0) {
        detailBody = {
          ...detailBody,
          hotelStructured: { ...detailBody.hotelStructured, rows: repaired.rows as typeof detailBody.hotelStructured.rows, reviewNeeded: false },
        }
        repairLog[target] = { ...repairLog[target]!, applied: true }
      }
      if (target === 'optional_tour_section' && Array.isArray(repaired.rows) && repaired.rows.length > 0) {
        detailBody = {
          ...detailBody,
          optionalToursStructured: {
            ...detailBody.optionalToursStructured,
            rows: repaired.rows as typeof detailBody.optionalToursStructured.rows,
            reviewNeeded: false,
          },
        }
        repairLog[target] = { ...repairLog[target]!, applied: true }
      }
      if (target === 'shopping_section' && Array.isArray(repaired.rows) && repaired.rows.length > 0) {
        detailBody = {
          ...detailBody,
          shoppingStructured: {
            ...detailBody.shoppingStructured,
            rows: repaired.rows as typeof detailBody.shoppingStructured.rows,
            shoppingCountText:
              typeof repaired.shoppingCountText === 'string' ? repaired.shoppingCountText : detailBody.shoppingStructured.shoppingCountText,
            reviewNeeded: false,
          },
        }
        repairLog[target] = { ...repairLog[target]!, applied: true }
      }
      if (target === 'flight_section' && repaired.outbound && repaired.inbound) {
        detailBody = {
          ...detailBody,
          flightStructured: {
            ...detailBody.flightStructured,
            ...(typeof repaired.airlineName === 'string' ? { airlineName: repaired.airlineName } : {}),
            outbound: repaired.outbound as typeof detailBody.flightStructured.outbound,
            inbound: repaired.inbound as typeof detailBody.flightStructured.inbound,
            rawFlightLines: Array.isArray(repaired.rawFlightLines)
              ? (repaired.rawFlightLines as string[])
              : detailBody.flightStructured.rawFlightLines,
            reviewNeeded: false,
          },
        }
        repairLog[target] = { ...repairLog[target]!, applied: true }
      }
      if (target === 'included_excluded_section') {
        const includedItems = Array.isArray(repaired.includedItems) ? (repaired.includedItems as string[]) : []
        const excludedItems = Array.isArray(repaired.excludedItems) ? (repaired.excludedItems as string[]) : []
        if (includedItems.length > 0 || excludedItems.length > 0) {
          detailBody = {
            ...detailBody,
            includedExcludedStructured: {
              ...detailBody.includedExcludedStructured,
              includedItems,
              excludedItems,
              noteText:
                typeof repaired.noteText === 'string' ? repaired.noteText : detailBody.includedExcludedStructured.noteText,
              reviewNeeded: false,
            },
          }
          repairLog[target] = { ...repairLog[target]!, applied: true }
        }
      }
    }
    detailBody = { ...detailBody, geminiRepairLog: repairLog }
  }
  options?.onTiming?.('after-section-repairs')
  console.info(
    `[ybtour][timing] section-repairs-total +${Date.now() - tSectionRepairs}ms maxRepairs=${maxSectionRepairs} used=${sectionRepairsUsed} forPreview=${Boolean(options?.forPreview)}`
  )
  const blockB = rawText.trim() ? rawText.slice(0, REGISTER_PASTE_MAX_CHARS) : EMPTY_PASTE_PLACEHOLDER
  const pb = options?.pastedBlocks ?? {}
  const manualPasteAxes = readManualPasteAxesFromBlocks(pb)
  const forPreview = Boolean(options?.forPreview)
  const labeledInput = forPreview
    ? buildRegisterPreviewMinimalLlmInputBlocks({
        pastedBody: blockB,
        priceTable: pb.priceTable ?? null,
        airlineTransport: pb.airlineTransport ?? null,
        optionalTour: pb.optionalTour ?? null,
        shopping: pb.shopping ?? null,
        includedExcluded: pb.includedExcluded ?? null,
        hotel: pb.hotel ?? null,
        requiredChecks: pb.requiredChecks ?? null,
      })
    : buildRegisterLlmInputBlocks(
        {
          pastedBody: blockB,
          priceTable: pb.priceTable ?? null,
          airlineTransport: pb.airlineTransport ?? null,
          optionalTour: pb.optionalTour ?? null,
          shopping: pb.shopping ?? null,
          includedExcluded: pb.includedExcluded ?? null,
          hotel: pb.hotel ?? null,
          requiredChecks: pb.requiredChecks ?? null,
        },
        { forPreview: false }
      )
  let scheduleFirstPassRows: CommonScheduleDayRow[] | null = null
  let useScheduleEmptyMainPrompt = false
  /** preview에서도 일정 일수를 추정하면 schedule-first 전용 LLM으로 미리 채워, 미리보기 후 풀 파싱 복구를 피한다. */
  const expectedDaysForSchedule = inferExpectedScheduleDayCountFromPaste(blockB, '')
  if (expectedDaysForSchedule != null && expectedDaysForSchedule >= 1) {
    const tScheduleExtract = Date.now()
    const sr = await runScheduleExtractLlm(model, blockB, expectedDaysForSchedule, {
      logLabel: forPreview
        ? 'parseForRegisterLlmYbtour-schedule-first-preview'
        : 'parseForRegisterLlmYbtour-schedule-first',
    })
    console.info(
      `[ybtour][timing] schedule-extract-llm +${Date.now() - tScheduleExtract}ms forPreview=${forPreview} expectedDays=${expectedDaysForSchedule} gotRows=${sr.rows.length}`
    )
    if (sr.rows.length === expectedDaysForSchedule) {
      scheduleFirstPassRows = sr.rows
      if (!forPreview) useScheduleEmptyMainPrompt = true
    } else if (sr.rows.length > 0) {
      scheduleFirstPassRows = sr.rows
    }
  }
  const registerPromptBody = useScheduleEmptyMainPrompt
    ? registerPromptWithScheduleEmptyForConfirm(REGISTER_PROMPT)
    : REGISTER_PROMPT
  const prompt = forPreview
    ? `${REGISTER_PREVIEW_MINIMAL_PROMPT}\n\n${labeledInput}`.trim()
    : `${registerPromptBody}\n\n${labeledInput}`.trim()


  options?.onTiming?.('llm-start')
  if (options?.llmCallMetrics) options.llmCallMetrics.mainLlm += 1
  const tMainGen = Date.now()
  const result = await model.generateContent(
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: forPreview ? 4096 : REGISTER_FULL_MAX_OUTPUT_TOKENS,
        /** 가능한 모델에서 순수 JSON만 받아 마크다운·설명 혼입 완화 (@google/generative-ai 타입에 없을 수 있어 단언) */
        ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
      },
    },
    geminiTimeoutOpts()
  )
  console.info(
    `[ybtour][timing] main-generateContent +${Date.now() - tMainGen}ms forPreview=${forPreview} maxOutTokens=${forPreview ? 4096 : REGISTER_FULL_MAX_OUTPUT_TOKENS}`
  )
  options?.onTiming?.('llm-end')
  const finishReason = result.response.candidates?.[0]?.finishReason
  let text = result.response.text()
  const firstPassLlmRawCaptured = text
  let repairAttempted = false
  let repairFinishReason: string | null = null
  let repairLlmRawCaptured: string | null = null
  let firstParseError: string | undefined
  if (forPreview) {
    const te = text.trimEnd()
    console.info('[ybtour-llm] preview Gemini response shape', {
      finishReason: finishReason ?? null,
      endsWithClosingBrace: te.endsWith('}'),
      charLength: text.length,
      minimalPrompt: true,
    })
  }
  if (finishReason === 'MAX_TOKENS') {
    console.error('[ybtour-llm] Gemini finishReason=MAX_TOKENS (출력 상한 도달·JSON 잘림 가능)', {
      forPreview,
      endsWithClosingBrace: text.trimEnd().endsWith('}'),
      rawLength: text.length,
    })
  }
  let raw: RegisterGeminiLlmJson
  options?.onTiming?.('parse-start')
  try {
    if (forPreview) {
      const previewLlm = parseLlmJsonObject<Record<string, unknown>>(text, {
        logLabel: 'parseForRegisterLlmYbtour-preview-minimal',
      })
      const det = buildPreviewDeterministicRegisterRaw({
        detailBody,
        blockB,
        pastedHotel: pb.hotel ?? null,
        originSource,
        brandKey: REGISTER_BRAND,
        originUrl: options?.originUrl?.trim() || null,
        resolveDirectedLines: resolveLines,
      })
      raw = finalizePreviewRegisterRaw(mergePreviewDeterministicWithLlm(det, previewLlm))
    } else {
      raw = parseLlmJsonObject<RegisterGeminiLlmJson>(text, { logLabel: 'parseForRegisterLlmYbtour' })
    }
    options?.onTiming?.('after-parse')
  } catch (firstErr) {
    options?.onTiming?.('parse-failed')
    firstParseError = firstErr instanceof Error ? firstErr.message : String(firstErr)
    const te = text.trimEnd()
    // JSON repair는 출력 잘림·MAX_TOKENS 등 명백한 truncation에만 제한(단순 스키마/형식 오류는 재호출하지 않음 → 토큰 절감).
    const shouldAttemptJsonRepair =
      finishReason === 'MAX_TOKENS' ||
      !te.endsWith('}') ||
      (Boolean(firstParseError?.includes('Unterminated string')) && !te.endsWith('}'))
    if (!shouldAttemptJsonRepair) {
      console.error('[ybtour-llm] LLM JSON parse failed; repair skipped (truncation/형식 정책)', {
        finishReason,
        length: text.length,
        endsWithClosingBrace: te.endsWith('}'),
        firstError: firstParseError,
      })
      options?.onTiming?.('repair-skipped')
      throw new RegisterLlmParseError({
        message: firstParseError,
        parseErrorMessage: firstParseError,
        firstPassLlmRaw: firstPassLlmRawCaptured,
        repairLlmRaw: null,
        repairAttempted: false,
        finishReason: finishReason ?? null,
        repairFinishReason: null,
      })
    }
    repairAttempted = true
    console.error('[ybtour-llm] LLM JSON parse failed; attempting one repair generateContent call', {
      finishReason,
      length: text.length,
      firstError: firstParseError,
    })
    const repairPrompt = `Return ONLY one valid JSON object, no markdown, no code fence. Fix the broken JSON below: add missing closing braces, brackets, and double-quotes; remove trailing commas before } or ]; keep readable keys and values. Use null for values that were cut off mid-string.

---
${text.slice(0, 16000)}`
    options?.onTiming?.('repair-start')
    if (options?.llmCallMetrics) options.llmCallMetrics.repairLlm += 1
    const tJsonRepairGen = Date.now()
    const repairResult = await model.generateContent(
      {
        contents: [{ role: 'user', parts: [{ text: repairPrompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: forPreview ? 4096 : REGISTER_FULL_MAX_OUTPUT_TOKENS,
          ...( { responseMimeType: 'application/json' } as { responseMimeType?: string }),
        },
      },
      geminiTimeoutOpts()
    )
    options?.onTiming?.('repair-end')
    console.info(
      `[ybtour][timing] json-repair-generateContent +${Date.now() - tJsonRepairGen}ms forPreview=${forPreview}`
    )
    repairFinishReason = repairResult.response.candidates?.[0]?.finishReason ?? null
    text = repairResult.response.text()
    repairLlmRawCaptured = text
    try {
      if (forPreview) {
        const previewLlm = parseLlmJsonObject<Record<string, unknown>>(text, {
          logLabel: 'parseForRegisterLlmYbtour-preview-minimal-repair',
        })
        const det = buildPreviewDeterministicRegisterRaw({
          detailBody,
          blockB,
          pastedHotel: pb.hotel ?? null,
          originSource,
          brandKey: REGISTER_BRAND,
          originUrl: options?.originUrl?.trim() || null,
          resolveDirectedLines: resolveLines,
        })
        raw = finalizePreviewRegisterRaw(mergePreviewDeterministicWithLlm(det, previewLlm))
      } else {
        raw = parseLlmJsonObject<RegisterGeminiLlmJson>(text, { logLabel: 'parseForRegisterLlmYbtour-repair-retry' })
      }
      options?.onTiming?.('after-repair-parse')
    } catch (repairParseErr) {
      options?.onTiming?.('after-repair-parse-failed')
      const repairMsg = repairParseErr instanceof Error ? repairParseErr.message : String(repairParseErr)
      throw new RegisterLlmParseError({
        message: repairMsg,
        parseErrorMessage: repairMsg,
        firstPassLlmRaw: firstPassLlmRawCaptured,
        repairLlmRaw: repairLlmRawCaptured,
        repairAttempted: true,
        finishReason: finishReason ?? null,
        repairFinishReason,
      })
    }
  }
  if (!forPreview && scheduleFirstPassRows?.length && expectedDaysForSchedule != null && expectedDaysForSchedule >= 1) {
    const merged = mergeScheduleWithFirstPassPreferExtractRows(raw.schedule, scheduleFirstPassRows, expectedDaysForSchedule)
    if (merged) {
      raw = { ...raw, schedule: merged as RegisterGeminiLlmJson['schedule'] }
    }
  } else if (
    forPreview &&
    scheduleFirstPassRows &&
    scheduleFirstPassRows.length > 0 &&
    (!(raw.schedule ?? []).length)
  ) {
    raw = { ...raw, schedule: scheduleFirstPassRows as RegisterGeminiLlmJson['schedule'] }
  }
  ybtourClearLlmWhenDedicatedPasteEmpty(raw, pb)
  let registerAdminPersistedLlmParsedJson: string | null = null
  try {
    registerAdminPersistedLlmParsedJson = clipRegisterAdminLlmParsedJsonString(JSON.stringify(raw))
  } catch {
    registerAdminPersistedLlmParsedJson = null
  }
  const scheduleBase: RegisterScheduleDay[] = (raw.schedule ?? [])
    .map((s) => {
      const rec = s as Record<string, unknown>
      return {
        day: Number(s?.day) || 0,
        title: String(s?.title ?? '').trim(),
        description: String(s?.description ?? '').trim(),
        imageKeyword: String(s?.imageKeyword ?? '').trim() || `Day ${s?.day ?? 0} travel`,
        hotelText: strOrNull(rec.hotelText),
        breakfastText: strOrNull(rec.breakfastText),
        lunchText: strOrNull(rec.lunchText),
        dinnerText: strOrNull(rec.dinnerText),
        mealSummaryText: strOrNull(rec.mealSummaryText),
      }
    })
    .filter((s) => s.day > 0)
  const schedule: RegisterScheduleDay[] = scheduleBase.map(supplementScheduleDayFromDescription)

  const titleTrimmed = (raw.title ?? '').trim() || '상품명 없음'
  const finalDestination = (raw.destination ?? '').trim() || extractDestinationFromTitle(titleTrimmed)

  const mustKnowFromLlm = forPreview
    ? []
    : (() => {
        const arr = Array.isArray(raw.mustKnowItems) ? raw.mustKnowItems : []
        const out: NonNullable<RegisterParsed['mustKnowItems']> = []
        const allowed = new Set([
          '입국/비자',
          '자녀동반',
          '현지준비',
          '안전/유의',
          '국내준비',
          '집결/탑승',
        ])
        for (const row of arr) {
          const r = row as Record<string, unknown>
          let category = String(r.category ?? '').trim()
          const title = String(r.title ?? '').trim()
          const body = String(r.body ?? '').trim()
          if (!title || !body) continue
          if (
            /상담|유의\s*키워드|보험|유류|불포함|선택관광|현지경비|가이드비|팁/i.test(`${category} ${title} ${body}`)
          ) {
            continue
          }
          if (!allowed.has(category)) category = '현지준비'
          out.push({
            category: category as NonNullable<RegisterParsed['mustKnowItems']>[0]['category'],
            title,
            body,
            raw: typeof r.raw === 'string' ? r.raw : undefined,
          })
          if (out.length >= 6) break
        }
        return out
      })()

  let mustKnowItems: NonNullable<RegisterParsed['mustKnowItems']> = [...mustKnowFromLlm]
  let mustKnowSource: NonNullable<RegisterParsed['mustKnowSource']> = 'supplier'
  let mustKnowNoticeRaw: string | null = null

  if (!forPreview && isMustKnowInsufficient(mustKnowItems)) {
    options?.onTiming?.('must-know-supplement-start')
    const sup = await supplementMustKnowWithWebSearch({
      destination: finalDestination,
      title: titleTrimmed,
      supplierItemsJson: JSON.stringify(mustKnowItems),
      pastedBodySnippet: (options?.pastedBodyForInference ?? rawText).slice(0, 4000),
    })
    if (sup.items.length > 0) {
      const seen = new Set(mustKnowItems.map((x) => `${x.title}\n${x.body}`.toLowerCase()))
      for (const it of sup.items) {
        const key = `${it.title}\n${it.body}`.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        const cat = allowedCategoryForSupplement(it.category)
        mustKnowItems.push({
          category: cat,
          title: it.title,
          body: it.body,
        })
        if (mustKnowItems.length >= 8) break
      }
      mustKnowSource = mustKnowFromLlm.length === 0 ? 'web' : 'supplier+web'
      mustKnowNoticeRaw = sup.noticeRaw
    }
    options?.onTiming?.('must-know-supplement-end')
  }

  const mustKnowRaw =
    (raw.mustKnowRaw ?? '').trim() ||
    (mustKnowItems.length > 0 ? mustKnowItems.map((x) => `- [${x.category}] ${x.title}: ${x.body}`).join('\n') : '') ||
    null

  let prices: ParsedProductPrice[] = (raw.prices ?? []).map((p) => {
    const rawDate = String(p?.date ?? '').trim()
    const date = normalizeCalendarDate(rawDate) || rawDate.slice(0, 10) || ''
    const ext = p as Record<string, unknown>
    const s = (k: string) => {
      const v = ext[k]
      return v != null && String(v).trim() ? String(v).trim() : undefined
    }
    return {
      date: date.length === 10 ? date : rawDate.slice(0, 10),
      adultBase: Number(p?.adultBase) || 0,
      adultFuel: Number(p?.adultFuel) || 0,
      childBedBase: p?.childBedBase != null ? Number(p.childBedBase) : undefined,
      childNoBedBase: p?.childNoBedBase != null ? Number(p.childNoBedBase) : undefined,
      childFuel: Number(p?.childFuel) || 0,
      infantBase: p?.infantBase != null ? Number(p.infantBase) : undefined,
      infantFuel: Number(p?.infantFuel) || 0,
      status: ((): ParsedProductPrice['status'] => {
        const st = p?.status
        if (
          st === '출발확정' ||
          st === '예약가능' ||
          st === '마감' ||
          st === '대기예약'
        )
          return st
        return '예약가능'
      })(),
      availableSeats: Number(p?.availableSeats) || 0,
      carrierName: s('carrierName'),
      outboundFlightNo: s('outboundFlightNo'),
      outboundDepartureAirport: s('outboundDepartureAirport'),
      outboundDepartureAt: s('outboundDepartureAt') ?? null,
      outboundArrivalAirport: s('outboundArrivalAirport'),
      outboundArrivalAt: s('outboundArrivalAt') ?? null,
      inboundFlightNo: s('inboundFlightNo'),
      inboundDepartureAirport: s('inboundDepartureAirport'),
      inboundDepartureAt: s('inboundDepartureAt') ?? null,
      inboundArrivalAirport: s('inboundArrivalAirport'),
      inboundArrivalAt: s('inboundArrivalAt') ?? null,
      meetingInfoRaw: s('meetingInfoRaw') ?? null,
      meetingPointRaw: s('meetingPointRaw') ?? null,
      meetingTerminalRaw: s('meetingTerminalRaw') ?? null,
      meetingGuideNoticeRaw: s('meetingGuideNoticeRaw') ?? null,
    }
  }).filter((p) => p.date.length >= 10)
  prices = applyProductLevelFlightMeeting(raw, prices)
  prices = mergeProductLevelFlightSegments(raw, prices)
  const segAirline = segmentSupplierPasteForLlm(rawText.slice(0, REGISTER_PASTE_MAX_CHARS)).airlineMeeting
  const flightSources = [
    rawText.trim(),
    (options?.pastedBlocks?.airlineTransport ?? '').trim(),
    segAirline,
  ]
  const flightEnriched = enrichParsedProductPricesWithFlightHeuristics(prices, flightSources)
  prices = flightEnriched.prices
  const rawReturnBlobForInbound = [
    rawText.trim(),
    (options?.pastedBlocks?.airlineTransport ?? '').trim(),
    strOrNull(raw.arrivalDateTimeRaw),
    strOrNull(raw.returnSegmentText),
    strOrNull(raw.routeRaw),
    strOrNull(raw.departureDateTimeRaw),
  ]
    .filter((x): x is string => Boolean(x && x.length > 0))
    .join('\n\n')
  const inboundDateEnriched = enrichParsedPricesInboundArrivalDateFromRawBlob(prices, rawReturnBlobForInbound)
  prices = inboundDateEnriched.prices
  const flightFieldIssues: RegisterExtractionFieldIssue[] = [
    ...flightEnriched.appendIssues.map((x) => ({ ...x, severity: 'warn' as const })),
    ...inboundDateEnriched.appendIssues.map((x) => ({ ...x, severity: 'warn' as const })),
  ]

  const normalizedSource = normalizeOriginSource(raw.originSource ?? originSource, REGISTER_BRAND)
  const finalOriginCode = (raw.originCode ?? '').trim() || '미지정'
  const pastedForSupplier = options?.pastedBodyForInference?.trim() ?? ''
  const supplierGroupFromText: string | null = null
  const firstPriceTotal = prices.length > 0
    ? (prices[0].adultBase ?? 0) + (prices[0].adultFuel ?? 0)
    : null
  const inferBase = pastedForSupplier.length > 0 ? pastedForSupplier : titleTrimmed
  const inferredProductType = inferProductTypeFromText(inferBase, titleTrimmed)
  const textForAirtel = pastedForSupplier.length > 0 ? pastedForSupplier : rawText
  const airtelHotelInfoJson =
    inferredProductType === 'airtel' ? extractAirtelHotelInfoJson(textForAirtel) : null
  const airportTransferType =
    inferredProductType === 'airtel' ? inferAirportTransferType(textForAirtel) : null
  const signalsHaystack = buildRegisterSignalsHaystack(
    rawText,
    options?.pastedBodyForInference,
    options?.pastedBlocks
  )
  const optionalToursLineRegex = pb.optionalTour?.trim()
    ? extractOptionalToursStructured(signalsHaystack)
    : null
  const signals = ybtourBlankSignalsWhenDedicatedPasteEmpty(extractStructuredTourSignals(signalsHaystack), pb)
  const optMerged = mergeOptionalToursStructured({
    llmRows: raw.optionalTours,
    signalsJson: signals.optionalToursStructuredJson,
    lineRegexJson: optionalToursLineRegex,
  })
  const shopMerged = mergeShoppingStopsJson({
    llmRows: raw.shoppingStops,
    signalsJson: signals.shoppingStopsJson,
  })
  /** 옵션/쇼핑 입력란이 있으면 본문·regex·LLM 병합 JSON은 저장 SSOT로 쓰지 않고 보조(supplement)로만 보존 */
  let optionalCarryForSupplement: string | null = null
  let optionalToursStructuredFinal = optMerged.final
  if (manualPasteAxes.hasManualOptionalInput) {
    if (optionalToursStructuredFinal?.trim()) optionalCarryForSupplement = optionalToursStructuredFinal.trim()
    optionalToursStructuredFinal = null
  }
  let shoppingCarryForSupplement: string | null = null
  let shoppingStopsJsonFinal = shopMerged.final
  if (manualPasteAxes.hasManualShoppingInput) {
    if (shoppingStopsJsonFinal?.trim()) shoppingCarryForSupplement = shoppingStopsJsonFinal.trim()
    shoppingStopsJsonFinal = null
  }
  let optionalToursLlmSupplementJson =
    optMerged.llmSupplement &&
    optMerged.llmSupplement.trim() !== (optionalToursStructuredFinal ?? '').trim()
      ? optMerged.llmSupplement
      : null
  if (optionalCarryForSupplement) {
    optionalToursLlmSupplementJson = [optionalToursLlmSupplementJson, optionalCarryForSupplement]
      .filter(Boolean)
      .join('\n---\n')
  }
  optionalToursLlmSupplementJson = optionalToursLlmSupplementJson?.trim() ? optionalToursLlmSupplementJson : null
  let shoppingStopsLlmSupplementJson =
    shopMerged.llmSupplement &&
    shopMerged.llmSupplement.trim() !== (shoppingStopsJsonFinal ?? '').trim()
      ? shopMerged.llmSupplement
      : null
  if (shoppingCarryForSupplement) {
    shoppingStopsLlmSupplementJson = [shoppingStopsLlmSupplementJson, shoppingCarryForSupplement]
      .filter(Boolean)
      .join('\n---\n')
  }
  shoppingStopsLlmSupplementJson = shoppingStopsLlmSupplementJson?.trim() ? shoppingStopsLlmSupplementJson : null
  const extractionFieldIssues: RegisterExtractionFieldIssue[] = [
    ...parseLlmExtractionFieldIssues(raw.fieldIssues),
    ...optMerged.issues,
    ...shopMerged.issues,
    ...flightFieldIssues,
  ]
  {
    const sr = detailBody.sectionReview ?? {}
    const pushBlock = (field: string, block: { required?: string[]; warning?: string[]; info?: string[] } | undefined) => {
      if (!block) return
      for (const reason of block.required ?? []) {
        extractionFieldIssues.push({
          field,
          reason: `[REVIEW REQUIRED] ${reason}`,
          source: 'auto',
          severity: 'warn',
        })
      }
      for (const reason of block.warning ?? []) {
        extractionFieldIssues.push({ field, reason, source: 'auto', severity: 'warn' })
      }
      for (const reason of block.info ?? []) {
        extractionFieldIssues.push({ field, reason, source: 'auto', severity: 'info' })
      }
    }
    pushBlock('flight_info', sr.flight_section)
    pushBlock('shoppingStops', sr.shopping_section)
    pushBlock('optionalToursStructured', sr.optional_tour_section)
    pushBlock('hotel_info', sr.hotel_section)
    pushBlock('detail_body', sr.included_excluded_section)
    if (detailBody.sections.length < 2) {
      extractionFieldIssues.push({
        field: 'detail_body',
        reason: '[REVIEW REQUIRED] 본문 섹션 분리 실패',
        source: 'auto',
        severity: 'warn',
      })
    }
  }
  if (signals.optionalTourSourceCount > MAX_OPTIONAL_TOURS) {
    extractionFieldIssues.push({
      field: 'optionalToursStructured',
      reason: `선택관광 행이 ${signals.optionalTourSourceCount}개로 감지되어 상한 ${MAX_OPTIONAL_TOURS}개까지만 보존했습니다.`,
      source: 'auto',
      severity: 'warn',
    })
  }
  if (signals.shoppingSourceCount > MAX_SHOPPING_STOPS) {
    extractionFieldIssues.push({
      field: 'shoppingStops',
      reason: `쇼핑 행이 ${signals.shoppingSourceCount}개로 감지되어 상한 ${MAX_SHOPPING_STOPS}개까지만 보존했습니다.`,
      source: 'auto',
      severity: 'warn',
    })
  }

  const noticeRaw =
    (raw.optionalTourNoticeRaw ?? '').trim() || signals.optionalTourNoticeRaw || null
  const noticeItemsLlm = Array.isArray(raw.optionalTourNoticeItems)
    ? raw.optionalTourNoticeItems.map((x) => String(x))
    : []
  const optionalTourNoticeItemsFinal =
    noticeItemsLlm.length > 0 ? noticeItemsLlm : signals.optionalTourNoticeItems

  const optionalRowsDetailCount = detailBody.optionalToursStructured.rows.length
  let optCountFinal = optionalRowsDetailCount
  if (optCountFinal === 0 && optionalToursStructuredFinal) {
    try {
      const arr = JSON.parse(optionalToursStructuredFinal) as unknown[]
      optCountFinal = Array.isArray(arr) ? arr.length : 0
    } catch {
      optCountFinal = 0
    }
  }
  const hasOptionalTourFinal =
    optCountFinal > 0 ||
    (manualPasteAxes.hasManualOptionalInput && Boolean(String(pb.optionalTour ?? '').trim())) ||
    optionalTourNoticeItemsFinal.length > 0 ||
    Boolean(raw.hasOptionalTour) ||
    signals.hasOptionalTour
  const optionalTourCountFinal =
    optCountFinal > 0
      ? optCountFinal
      : manualPasteAxes.hasManualOptionalInput && Boolean(String(pb.optionalTour ?? '').trim())
        ? undefined
        : raw.optionalTourCount != null
          ? Number(raw.optionalTourCount)
          : signals.optionalTourCount
  const optionalTourSummaryFinal =
    (raw.optionalTourSummaryText ?? '').trim() ||
    (optCountFinal > 1
      ? `현지옵션 ${optCountFinal}개`
      : optCountFinal === 1
        ? '현지옵션 있음'
        : manualPasteAxes.hasManualOptionalInput && Boolean(String(pb.optionalTour ?? '').trim())
          ? '현지옵션 입력 있음'
          : noticeItemsLlm.length > 0 || noticeRaw
            ? '현지옵션 안내만 있음'
            : signals.optionalTourSummaryText)

  const shopCountFromJson = (): number => {
    if (!shoppingStopsJsonFinal) return 0
    try {
      const arr = JSON.parse(shoppingStopsJsonFinal) as unknown[]
      return Array.isArray(arr) ? arr.length : 0
    } catch {
      return 0
    }
  }
  const shopRowsDetailCount = detailBody.shoppingStructured.rows.length
  let shopRows = shopRowsDetailCount > 0 ? shopRowsDetailCount : shopCountFromJson()
  const hasShoppingFinal =
    Boolean(raw.hasShopping) ||
    signals.hasShopping ||
    shopRows > 0 ||
    (manualPasteAxes.hasManualShoppingInput && Boolean(String(pb.shopping ?? '').trim())) ||
    (raw.shoppingVisitCount != null && Number(raw.shoppingVisitCount) > 0)
  /** 요약 문구(정규 추출) 우선 — 표 row 수와 동일 의미가 아님 */
  const shoppingVisitCountFinal =
    manualPasteAxes.hasManualShoppingInput && Boolean(String(pb.shopping ?? '').trim()) && shopRows <= 0
      ? null
      : signals.shoppingVisitCount != null
        ? signals.shoppingVisitCount
        : raw.shoppingVisitCount != null
          ? Number(raw.shoppingVisitCount)
          : null
  const shoppingSummaryFinal =
    (raw.shoppingSummaryText ?? '').trim() ||
    (manualPasteAxes.hasManualShoppingInput &&
    Boolean(String(pb.shopping ?? '').trim()) &&
    shopRows <= 0
      ? '쇼핑 입력 있음'
      : signals.shoppingSummaryText)

  if (
    !(
      manualPasteAxes.hasManualShoppingInput && Boolean(String(pb.shopping ?? '').trim())
    ) &&
    shouldEmitShoppingBothEmptyExtractionIssue({
      hasShoppingFromBodyOrSignals: Boolean(raw.hasShopping) || signals.hasShopping,
      shopRowCount: shopRows,
      visitCount: shoppingVisitCountFinal,
    })
  ) {
    extractionFieldIssues.push({
      field: 'shoppingStops',
      reason: '본문에 쇼핑 안내가 있는 것으로 보이나, 후보지 목록과 방문 횟수가 모두 비어 있습니다.',
      source: 'auto',
      severity: 'warn',
    })
  }

  const freeTimeMentionsMerged = Array.from(
    new Set([...(signals.freeTimeRawMentions ?? []), ...((raw.freeTimeRawMentions ?? []).map((x) => String(x)))])
  )
  const freeTimeSummaryFinal =
    (raw.freeTimeSummaryText ?? '').trim() || signals.freeTimeSummaryText
  const hasFreeTimeFinal =
    raw.hasFreeTime === true || signals.hasFreeTime || freeTimeMentionsMerged.length > 0

  const pricePromotion = forPreview ? null : parsePricePromotionFromGeminiJson(raw.pricePromotion)

  const includedItems = Array.isArray(raw.includedItems) ? raw.includedItems.map((x) => String(x)) : []
  const excludedItemsBase = Array.isArray(raw.excludedItems) ? raw.excludedItems.map((x) => String(x)) : []
  const llmSingleRoomAmount = numOrNull(raw.singleRoomSurchargeAmount)
  const llmSingleRoomCurrency = strOrNull(raw.singleRoomSurchargeCurrency)
  const llmSingleRoomRaw = strOrNull(raw.singleRoomSurchargeRaw)
  const llmSingleRoomDisplay = strOrNull(raw.singleRoomSurchargeDisplayText)
  const inferredSingleRoom = extractSingleRoomSurcharge(
    [
      strOrNull(raw.excludedRaw),
      strOrNull(raw.excludedText),
      strOrNull(raw.includedExcludedRaw),
      options?.pastedBlocks?.includedExcluded ?? null,
      options?.pastedBodyForInference ?? rawText,
    ]
      .filter((x): x is string => Boolean(x?.trim()))
      .join('\n')
  )
  const singleRoomSurchargeAmount = llmSingleRoomAmount ?? inferredSingleRoom.amount
  const singleRoomSurchargeCurrency =
    llmSingleRoomCurrency ?? inferredSingleRoom.currency ?? (singleRoomSurchargeAmount != null ? 'KRW' : null)
  const singleRoomSurchargeRaw = llmSingleRoomRaw ?? inferredSingleRoom.raw
  const hasSingleRoomSurcharge =
    Boolean(raw.hasSingleRoomSurcharge) ||
    singleRoomSurchargeAmount != null ||
    Boolean(singleRoomSurchargeRaw?.trim()) ||
    Boolean(llmSingleRoomDisplay?.trim())
  const singleRoomSurchargeDisplayText = hasSingleRoomSurcharge
    ? buildSingleRoomExcludedLine(llmSingleRoomDisplay, singleRoomSurchargeAmount, singleRoomSurchargeCurrency, {
        useFallbackWhenEmpty: true,
      })
    : null
  const excludedTextSource = strOrNull(raw.excludedRaw) ?? strOrNull(raw.excludedText)
  const excludedTextHasSingleRoom = excludedTextSource
    ? hasSingleRoomSurchargeHint(excludedTextSource)
    : false
  const excludedItems = [...excludedItemsBase]
  if (singleRoomSurchargeDisplayText && !excludedTextHasSingleRoom) {
    const existingKeys = new Set(excludedItems.map((x) => normalizeDedupText(x)))
    const nextKey = normalizeDedupText(singleRoomSurchargeDisplayText)
    if (!existingKeys.has(nextKey)) excludedItems.push(singleRoomSurchargeDisplayText)
  }
  const includedTextMerged =
    (raw.includedRaw as string)?.trim() ||
    (includedItems.length > 0 ? includedItems.join('\n') : null) ||
    (raw.includedText as string)?.trim() ||
    null
  const excludedTextMerged =
    (raw.excludedRaw as string)?.trim() ||
    (excludedItems.length > 0 ? excludedItems.join('\n') : null) ||
    (raw.excludedText as string)?.trim() ||
    null

  let airtelHotelInfoJsonOut =
    inferredProductType === 'airtel' ? extractAirtelHotelInfoJson(textForAirtel) : null
  if (inferredProductType === 'airtel') {
    airtelHotelInfoJsonOut = mergeAirtelHotelJsonWithLlm(airtelHotelInfoJsonOut, {
      hotelInfoRaw: strOrNull(raw.hotelInfoRaw),
      hotelNames: Array.isArray(raw.hotelNames) ? raw.hotelNames.map((x) => String(x)) : undefined,
      hotelStatusText: strOrNull(raw.hotelStatusText),
      hotelNoticeRaw: strOrNull(raw.hotelNoticeRaw),
    })
  }

  const productPriceTableRaw = raw.productPriceTable
  let productPriceTable =
    productPriceTableRaw && typeof productPriceTableRaw === 'object'
      ? {
          adultPrice: numOrNull((productPriceTableRaw as { adultPrice?: unknown }).adultPrice),
          childExtraBedPrice: numOrNull(
            (productPriceTableRaw as { childExtraBedPrice?: unknown }).childExtraBedPrice ??
              (productPriceTableRaw as { childBedPrice?: unknown }).childBedPrice
          ),
          childNoBedPrice: numOrNull((productPriceTableRaw as { childNoBedPrice?: unknown }).childNoBedPrice),
          infantPrice: numOrNull((productPriceTableRaw as { infantPrice?: unknown }).infantPrice),
        }
      : null

  const priceBlobForInfant = [
    (pb.priceTable ?? '').trim(),
    strOrNull(raw.priceTableRawText) ?? '',
    stripHtmlForPriceBlob(strOrNull(raw.priceTableRawHtml)),
    blockB,
  ]
    .filter((x) => String(x).length > 0)
    .join('\n\n')

  const infantMerged = mergeInfantPriceIntoProductPriceTable(productPriceTable, priceBlobForInfant)
  const mergedTable = infantMerged.productPriceTable
  const afterInfant = mergedTable
    ? {
        adultPrice: mergedTable.adultPrice ?? null,
        childExtraBedPrice: mergedTable.childExtraBedPrice ?? null,
        childNoBedPrice: mergedTable.childNoBedPrice ?? null,
        infantPrice: mergedTable.infantPrice ?? null,
      }
    : null
  const labelTier = extractProductPriceTableByLabels(priceBlobForInfant)
  const mergedLabels = mergeProductPriceTableWithLabelExtract(afterInfant, labelTier)
  productPriceTable = mergedLabels
    ? {
        adultPrice: mergedLabels.adultPrice ?? null,
        childExtraBedPrice: mergedLabels.childExtraBedPrice ?? null,
        childNoBedPrice: mergedLabels.childNoBedPrice ?? null,
        infantPrice: mergedLabels.infantPrice ?? null,
      }
    : null
  const priceFromResolved =
    firstPriceTotal != null && firstPriceTotal > 0
      ? firstPriceTotal
      : productPriceTable?.adultPrice != null && productPriceTable.adultPrice > 0
        ? productPriceTable.adultPrice
        : firstPriceTotal
  for (const issue of infantMerged.issues) {
    extractionFieldIssues.push({
      field: issue.field,
      reason: issue.reason,
      source: issue.source,
      severity: issue.severity,
    })
  }

  const departureHaystack = [
    pastedForSupplier,
    blockB,
    includedTextMerged ?? '',
    excludedTextMerged ?? '',
    strOrNull(raw.mustKnowRaw),
  ]
    .filter((x) => String(x).trim().length > 0)
    .join('\n')
  const depExtract = extractMinimumDepartureMeta(departureHaystack)
  const llmMin = numOrNull((raw as { minimumDepartureCount?: unknown }).minimumDepartureCount)
  const llmBooked = numOrNull((raw as { currentBookedCount?: unknown }).currentBookedCount)
  const llmGuaranteed = (raw as { isDepartureGuaranteed?: unknown }).isDepartureGuaranteed === true
  const minimumDepartureCount = depExtract.minimumDepartureCount ?? llmMin
  const currentBookedCount = depExtract.currentBookedCount ?? llmBooked
  const isDepartureGuaranteedFlag = depExtract.isDepartureGuaranteed || llmGuaranteed
  const minimumDepartureText =
    minimumDepartureCount != null
      ? `최소출발 ${minimumDepartureCount}명`
      : strOrNull((raw as { minimumDepartureText?: unknown }).minimumDepartureText) ?? depExtract.minimumDepartureText
  const departureStatusText =
    buildDepartureStatusDisplay({
      isDepartureGuaranteed: isDepartureGuaranteedFlag,
      minimumDepartureCount,
      currentBookedCount,
      minimumDepartureText,
      remainingSeatsCount: depExtract.remainingSeatsCount,
    }) ?? strOrNull((raw as { departureStatusText?: unknown }).departureStatusText)
  for (const fi of depExtract.fieldIssues) {
    extractionFieldIssues.push({
      field: fi.field,
      reason: fi.reason,
      source: 'auto',
      severity: 'warn',
    })
  }

  normalizeDestinationExtractionIssuesInPlace(extractionFieldIssues)
  for (const coh of buildDestinationCoherenceFieldIssues({
    representativeDestination: finalDestination,
    schedule,
    flight: detailBody.flightStructured,
  })) {
    extractionFieldIssues.push(coh)
  }

  const { departureSegmentFromStructured, returnSegmentFromStructured } = resolveLines(detailBody)

  const airlineDisplay = manualPasteAxes.hasManualFlightInput
    ? detailBody.flightStructured.airlineName ?? null
    : detailBody.flightStructured.airlineName ?? strOrNull(raw.airlineName) ?? strOrNull(raw.airline)

  const dayHotelPlans = mergeDayHotelPlansForRegister(
    raw.dayHotelPlans,
    schedule,
    strOrNull(raw.hotelInfoRaw),
    pb.hotel ?? null
  )

  const optionalRowsFromDetail = detailBody.optionalToursStructured.rows
  const optionalToursStructuredForRegister: string | null =
    optionalRowsFromDetail.length > 0
      ? buildOptionalToursStructuredForRegisterJson(optionalRowsFromDetail, optionalToursStructuredFinal)
      : optionalToursStructuredFinal

  const registerParseAudit: RegisterParseAudit = {
    capturedAt: new Date().toISOString(),
    model: getModelName(),
    finishReasonFirstPass: finishReason ?? null,
    firstPassLlmRaw: clipRegisterLlmAuditText(firstPassLlmRawCaptured),
    repairAttempted,
    repairFinishReason: repairAttempted ? repairFinishReason : null,
    repairLlmRaw: repairLlmRawCaptured != null ? clipRegisterLlmAuditText(repairLlmRawCaptured) : null,
    firstParseError: firstParseError ?? null,
    finalParseOk: true,
  }
  options?.onTiming?.('register-parsed-ready')

  return {
    originSource: normalizedSource,
    originCode: finalOriginCode,
    title: titleTrimmed,
    destination: finalDestination,
    destinationRaw: finalDestination || null,
    primaryDestination: finalDestination || null,
    supplierGroupId: supplierGroupFromText || null,
    productType: inferredProductType,
    airtelHotelInfoJson: airtelHotelInfoJsonOut,
    airportTransferType,
    optionalToursStructured: optionalToursStructuredForRegister,
    optionalToursLlmSupplementJson,
    optionalTourNoticeRaw: noticeRaw,
    optionalTourNoticeItems: optionalTourNoticeItemsFinal,
    optionalTourDisplayNoticeFinal: strOrNull(raw.optionalTourDisplayNoticeFinal),
    hasOptionalTour: hasOptionalTourFinal,
    optionalTourCount: optionalTourCountFinal,
    optionalTourSummaryText: optionalTourSummaryFinal,
    shoppingNoticeRaw: (raw.shoppingNoticeRaw ?? '').trim() || signals.shoppingNoticeRaw || null,
    shoppingStops:
      detailBody.shoppingStructured.rows.length > 0
        ? JSON.stringify(
            detailBody.shoppingStructured.rows.map((r) =>
              shoppingStructuredRowToPersistStop(r)
            )
          )
        : shoppingStopsJsonFinal,
    shoppingStopsLlmSupplementJson,
    hasShopping: hasShoppingFinal,
    shoppingVisitCount: shoppingVisitCountFinal,
    shoppingSummaryText: shoppingSummaryFinal,
    hasFreeTime: hasFreeTimeFinal,
    freeTimeSummaryText: freeTimeSummaryFinal,
    freeTimeRawMentions: freeTimeMentionsMerged,
    headerBadges: {
      optionalTour: hasOptionalTourFinal ? '현지옵션 있음' : '현지옵션 없음',
      shopping: shoppingSummaryFinal,
      freeTime: freeTimeSummaryFinal,
    },
    priceFrom: priceFromResolved,
    priceCurrency: priceFromResolved != null ? 'KRW' : null,
    duration: (raw.duration ?? '').trim() || '미지정',
    airline: airlineDisplay,
    isFuelIncluded: raw.isFuelIncluded !== false,
    isGuideFeeIncluded: raw.isGuideFeeIncluded === true,
    mandatoryLocalFee: raw.mandatoryLocalFee != null ? Number(raw.mandatoryLocalFee) : null,
    mandatoryCurrency: (raw.mandatoryCurrency as string)?.trim() || null,
    includedText: includedTextMerged,
    excludedText: excludedTextMerged,
    singleRoomSurchargeAmount,
    singleRoomSurchargeCurrency,
    singleRoomSurchargeRaw,
    singleRoomSurchargeDisplayText,
    hasSingleRoomSurcharge,
    criticalExclusions: (raw.criticalExclusions as string)?.trim() || null,
    counselingNotes: raw.counselingNotes ?? null,
    schedule,
    prices,
    pricePromotion,
    priceTableRawText: strOrNull(raw.priceTableRawText),
    priceTableRawHtml: strOrNull(raw.priceTableRawHtml),
    productPriceTable,
    airlineName: manualPasteAxes.hasManualFlightInput
      ? detailBody.flightStructured.airlineName ?? null
      : detailBody.flightStructured.airlineName ?? strOrNull(raw.airlineName),
    departureSegmentText: manualPasteAxes.hasManualFlightInput
      ? departureSegmentFromStructured
      : departureSegmentFromStructured ?? strOrNull(raw.departureSegmentText),
    returnSegmentText: manualPasteAxes.hasManualFlightInput
      ? returnSegmentFromStructured
      : returnSegmentFromStructured ?? strOrNull(raw.returnSegmentText),
    outboundFlightNo: manualPasteAxes.hasManualFlightInput
      ? detailBody.flightStructured.outbound.flightNo ?? null
      : detailBody.flightStructured.outbound.flightNo ?? strOrNull(raw.outboundFlightNo),
    inboundFlightNo: manualPasteAxes.hasManualFlightInput
      ? detailBody.flightStructured.inbound.flightNo ?? null
      : detailBody.flightStructured.inbound.flightNo ?? strOrNull(raw.inboundFlightNo),
    departureDateTimeRaw: manualPasteAxes.hasManualFlightInput ? null : strOrNull(raw.departureDateTimeRaw),
    arrivalDateTimeRaw: manualPasteAxes.hasManualFlightInput ? null : strOrNull(raw.arrivalDateTimeRaw),
    routeRaw: manualPasteAxes.hasManualFlightInput ? null : strOrNull(raw.routeRaw),
    meetingInfoRaw: strOrNull(raw.meetingInfoRaw),
    meetingPlaceRaw: strOrNull(raw.meetingPlaceRaw),
    meetingNoticeRaw: strOrNull(raw.meetingNoticeRaw),
    meetingFallbackText: strOrNull(raw.meetingFallbackText),
    includedItems,
    excludedItems,
    includedRaw: strOrNull(raw.includedRaw),
    excludedRaw: strOrNull(raw.excludedRaw),
    includedExcludedRaw: strOrNull(raw.includedExcludedRaw),
    hotelInfoRaw:
      detailBody.hotelStructured.rows.length > 0
        ? detailBody.hotelStructured.rows.map((r) => r.hotelNameText).join('\n')
        : strOrNull(raw.hotelInfoRaw),
    hotelNames:
      detailBody.hotelStructured.rows.length > 0
        ? detailBody.hotelStructured.rows.map((r) => r.hotelNameText).filter(Boolean)
        : Array.isArray(raw.hotelNames)
          ? raw.hotelNames.map((x) => String(x))
          : undefined,
    dayHotelPlans: dayHotelPlans.length ? dayHotelPlans : undefined,
    hotelSummaryText: strOrNull((raw as { hotelSummaryText?: unknown }).hotelSummaryText),
    hotelStatusText: strOrNull(raw.hotelStatusText),
    hotelNoticeRaw: strOrNull(raw.hotelNoticeRaw),
    extractionFieldIssues: filterRegisterExtractionIssuesShoppingGeminiNoise(extractionFieldIssues),
    mustKnowRaw,
    mustKnowItems,
    mustKnowSource,
    mustKnowNoticeRaw,
    minimumDepartureCount: minimumDepartureCount ?? null,
    minimumDepartureText: minimumDepartureText ?? null,
    isDepartureGuaranteed: isDepartureGuaranteedFlag ? true : null,
    currentBookedCount: currentBookedCount ?? null,
    departureStatusText: departureStatusText ?? null,
    detailBodyStructured: detailBody,
    registerParseAudit,
    registerAdminPersistedLlmParsedJson,
    ...(forPreview
      ? {
          registerPreviewPolicyNotes: [
            '미리보기: 출발일별 달력(prices[])는 확정(전체) 파싱에서 채웁니다. 항공·호텔·옵션·쇼핑·가격표 표는 결정적 파서·병합이 우선입니다.',
            '미리보기: 일정(schedule[])·달력 행이 비어 있어도 정상입니다. 확정(전체) 파싱에서 채우며, 아래는 메타·본문 구조 확인용입니다.',
          ],
        }
      : {}),
  }
}
