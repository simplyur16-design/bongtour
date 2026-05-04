/**
 * 교원이지(kyowontour) — 등록 플로우 통합 (Phase 2-C).
 * register-llm 1차 + schedule-extract 2차 + site-parser + 관리자 입력 병합.
 */
import {
  clipKyowontourRegisterBodyText,
  extractKyowontourRegisterWithGemini,
  type KyowontourFlightFromBody,
  type KyowontourMeetingInfo,
  type KyowontourOptionalTourFromBody,
  type KyowontourRegisterParsed,
  type KyowontourScheduleDayParsed,
  type KyowontourShoppingItemFromBody,
  KyowontourRegisterParseError,
} from '@/lib/kyowontour/register-llm'
import {
  inferExpectedScheduleDayCountFromKyowontourBody,
  mergeKyowontourScheduleWithFirstPass,
  runKyowontourScheduleExtractLlm,
  type KyowontourScheduleExtractRow,
} from '@/lib/kyowontour/schedule-extract'
import {
  parseKyowontourFlightFromBody,
  parseKyowontourHotelFromBody,
  parseKyowontourMeetingInfoFromBody,
  parseKyowontourPriceFromBody,
  parseKyowontourProductCodeFromBody,
  type KyowontourParsedPrices,
} from '@/lib/kyowontour/site-parser'

export type KyowontourAdminFlightInput = KyowontourFlightFromBody
export type KyowontourAdminOptionalTourInput = KyowontourOptionalTourFromBody
export type KyowontourAdminShoppingInput = KyowontourShoppingItemFromBody

export type KyowontourAdminInputs = {
  expectedDayCount?: number | null
  flight?: KyowontourAdminFlightInput | null
  optionalTours?: KyowontourAdminOptionalTourInput[] | null
  shoppingItems?: KyowontourAdminShoppingInput[] | null
  productCode?: string | null
  title?: string | null
}

export type KyowontourFlightFinal = KyowontourFlightFromBody
export type KyowontourScheduleFinal = KyowontourScheduleDayParsed
export type KyowontourOptionalTourFinal = KyowontourOptionalTourFromBody
export type KyowontourShoppingFinal = KyowontourShoppingItemFromBody

export type KyowontourSiteSnapshot = {
  productCode: string | null
  prices: KyowontourParsedPrices
  flight: KyowontourFlightFromBody | null
  meeting: KyowontourMeetingInfo | null
  hotelLine: string | null
}

export type KyowontourFinalParsed = {
  productCode: string
  title: string
  durationLabel: string
  expectedDayCount: number
  priceAdult: number
  priceChild: number
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'

  flight: KyowontourFlightFinal | null
  schedule: KyowontourScheduleFinal[]
  meetingInfo?: KyowontourMeetingInfo
  hotelGradeLabel?: string
  includedItems: string[]
  excludedItems: string[]

  optionalTours: KyowontourOptionalTourFinal[]
  shoppingItems: KyowontourShoppingFinal[]

  originalBodyText: string
  warnings: string[]
}

export type RunKyowontourRegisterOrchestrationOptions = {
  skipConnectionTest?: boolean
  skipScheduleExtract?: boolean
}

function collectSiteSnapshot(clippedBody: string): KyowontourSiteSnapshot {
  return {
    productCode: parseKyowontourProductCodeFromBody(clippedBody),
    prices: parseKyowontourPriceFromBody(clippedBody),
    flight: parseKyowontourFlightFromBody(clippedBody),
    meeting: parseKyowontourMeetingInfoFromBody(clippedBody),
    hotelLine: parseKyowontourHotelFromBody(clippedBody),
  }
}

function clampDayCount(n: number): number {
  if (!Number.isFinite(n)) return 1
  return Math.min(31, Math.max(1, Math.floor(n)))
}

function resolveExpectedDayCount(
  adminInputs: KyowontourAdminInputs,
  clippedBody: string,
  llm: KyowontourRegisterParsed
): { expectedDayCount: number; inferred: number | null } {
  const inferred = inferExpectedScheduleDayCountFromKyowontourBody(clippedBody, llm.durationLabel)
  const adminRaw = adminInputs.expectedDayCount
  const adminN =
    adminRaw != null && Number.isFinite(Number(adminRaw)) ? clampDayCount(Number(adminRaw)) : null
  if (adminN != null) return { expectedDayCount: adminN, inferred }
  if (inferred != null) return { expectedDayCount: clampDayCount(inferred), inferred }
  return { expectedDayCount: clampDayCount(llm.schedule.length), inferred }
}

function padScheduleToExpectedDays(
  merged: KyowontourScheduleDayParsed[],
  expectedDays: number,
  llmSchedule: KyowontourScheduleDayParsed[]
): KyowontourScheduleDayParsed[] {
  const mergedBy = new Map(merged.map((d) => [d.dayNumber, d]))
  const llmBy = new Map(llmSchedule.map((d) => [d.dayNumber, d]))
  const out: KyowontourScheduleDayParsed[] = []
  for (let d = 1; d <= expectedDays; d++) {
    const m = mergedBy.get(d)
    if (m) {
      out.push(m)
      continue
    }
    const fb = llmBy.get(d)
    if (fb) out.push(fb)
    else
      out.push({
        dayNumber: d,
        activities: [],
        meals: { breakfast: '', lunch: '', dinner: '' },
      })
  }
  return out
}

function priceMismatchWarnings(site: KyowontourParsedPrices, llm: KyowontourRegisterParsed): string[] {
  const w: string[] = []
  const pairs: [keyof KyowontourParsedPrices, keyof KyowontourRegisterParsed][] = [
    ['adult', 'priceAdult'],
    ['child', 'priceChild'],
    ['infant', 'priceInfant'],
  ]
  for (const [sk, lk] of pairs) {
    const sv = site[sk]
    const lv = llm[lk] as number
    if (sv != null && lv != null && sv !== lv) {
      w.push(`가격 불일치(site-parser vs LLM): ${String(sk)} site=${sv} llm=${lv}`)
    }
  }
  return w
}

function pickFlight(
  adminInputs: KyowontourAdminInputs,
  site: KyowontourSiteSnapshot,
  llm: KyowontourRegisterParsed
): KyowontourFlightFinal | null {
  const a = adminInputs.flight
  if (a?.outbound?.flightNo?.trim() && a?.inbound?.flightNo?.trim()) return a
  if (site.flight?.outbound?.flightNo?.trim() && site.flight?.inbound?.flightNo?.trim()) return site.flight
  return llm.flightFromBody ?? null
}

function pickOptionalTours(
  adminInputs: KyowontourAdminInputs,
  llm: KyowontourRegisterParsed
): KyowontourOptionalTourFinal[] {
  const a = adminInputs.optionalTours
  if (a && a.length > 0) return a
  return llm.optionalToursFromBody ?? []
}

function pickShopping(adminInputs: KyowontourAdminInputs, llm: KyowontourRegisterParsed): KyowontourShoppingFinal[] {
  const a = adminInputs.shoppingItems
  if (a && a.length > 0) return a
  return llm.shoppingItemsFromBody ?? []
}

function mergeMeeting(llm: KyowontourRegisterParsed, site: KyowontourSiteSnapshot): KyowontourMeetingInfo | undefined {
  const m = llm.meetingInfo
  if (m && (m.location || m.time)) return m
  const s = site.meeting
  if (s && (s.location || s.time)) return s
  return undefined
}

/**
 * Gemini·schedule-extract 이후 단계: 관리자 override, 경고, 검증.
 * (단위 테스트에서 Gemini 없이 호출 가능)
 */
export function buildKyowontourFinalFromLayers(input: {
  clippedBody: string
  adminInputs: KyowontourAdminInputs
  llmParsed: KyowontourRegisterParsed
  site: KyowontourSiteSnapshot
  mergedSchedule: KyowontourScheduleDayParsed[]
  inferredDayCount: number | null
  expectedDayCount: number
}): KyowontourFinalParsed {
  const { clippedBody, adminInputs, llmParsed, site, mergedSchedule, inferredDayCount, expectedDayCount } = input
  const warnings: string[] = []

  const adminDay =
    adminInputs.expectedDayCount != null && Number.isFinite(Number(adminInputs.expectedDayCount))
      ? clampDayCount(Number(adminInputs.expectedDayCount))
      : null
  const inferredDay = inferredDayCount != null ? clampDayCount(inferredDayCount) : null
  if (adminDay != null && inferredDay != null && adminDay !== inferredDay) {
    warnings.push(
      `expectedDayCount 불일치: 관리자=${adminDay}, 본문 추론=${inferredDay} (관리자 입력 우선 적용)`
    )
  }

  warnings.push(...priceMismatchWarnings(site.prices, llmParsed))

  const title = (adminInputs.title?.trim() || llmParsed.title).trim()
  if (!title) {
    throw new KyowontourRegisterParseError('최종 title이 비어 있습니다.')
  }

  const productCode = (adminInputs.productCode?.trim() || llmParsed.productCode || site.productCode || '').trim()
  if (!productCode) {
    throw new KyowontourRegisterParseError('최종 productCode가 비어 있습니다.')
  }

  const schedule = padScheduleToExpectedDays(mergedSchedule, expectedDayCount, llmParsed.schedule)

  return {
    productCode,
    title,
    durationLabel: llmParsed.durationLabel,
    expectedDayCount,
    priceAdult: llmParsed.priceAdult,
    priceChild: llmParsed.priceChild,
    priceInfant: llmParsed.priceInfant,
    fuelSurcharge: llmParsed.fuelSurcharge,
    currency: 'KRW',
    flight: pickFlight(adminInputs, site, llmParsed),
    schedule,
    meetingInfo: mergeMeeting(llmParsed, site),
    hotelGradeLabel: llmParsed.hotelGradeLabel ?? site.hotelLine ?? undefined,
    includedItems: llmParsed.includedItems,
    excludedItems: llmParsed.excludedItems,
    optionalTours: pickOptionalTours(adminInputs, llmParsed),
    shoppingItems: pickShopping(adminInputs, llmParsed),
    originalBodyText: clippedBody,
    warnings,
  }
}

/**
 * 본문 + 관리자 입력 → site-parser + register-llm + schedule-extract + 병합.
 */
export async function runKyowontourRegisterOrchestration(
  bodyText: string,
  adminInputs: KyowontourAdminInputs,
  options?: RunKyowontourRegisterOrchestrationOptions
): Promise<KyowontourFinalParsed> {
  const clipped = clipKyowontourRegisterBodyText(bodyText)
  if (!clipped) {
    throw new KyowontourRegisterParseError('empty bodyText')
  }

  const site = collectSiteSnapshot(clipped)
  const extraWarnings: string[] = []

  const llmResult = await extractKyowontourRegisterWithGemini(clipped, {
    skipConnectionTest: options?.skipConnectionTest,
  })
  const llmParsed = llmResult.parsed

  const { expectedDayCount, inferred } = resolveExpectedDayCount(adminInputs, clipped, llmParsed)

  let extractRows: KyowontourScheduleExtractRow[] = []
  if (!options?.skipScheduleExtract) {
    try {
      const sched = await runKyowontourScheduleExtractLlm(clipped, expectedDayCount, {
        skipConnectionTest: true,
        logLabel: 'kyowontour-orchestration',
      })
      extractRows = sched.rows
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      extraWarnings.push(`schedule-extract 실패(register-llm 일정 유지): ${msg}`)
    }
  }

  const merged = mergeKyowontourScheduleWithFirstPass(llmParsed.schedule, extractRows, expectedDayCount)

  const finalParsed = buildKyowontourFinalFromLayers({
    clippedBody: clipped,
    adminInputs,
    llmParsed,
    site,
    mergedSchedule: merged,
    inferredDayCount: inferred,
    expectedDayCount,
  })

  return {
    ...finalParsed,
    warnings: [...extraWarnings, ...finalParsed.warnings],
  }
}
