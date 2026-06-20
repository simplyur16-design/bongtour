/**
 * 모두투어 등록 — originUrl B2C API + 상세 HTML로 상세카드 축 자동 수집.
 * 붙여넣기·LLM·정형칸 SSOT가 있으면 덮지 않음.
 *
 * REGRESSION-FREEZE[modetour-register-detail-collect]: B2C+HTML register augment — manifest
 */
import type { RegisterParsed, RegisterScheduleDay } from '@/lib/register-llm-schema-modetour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-modetour'
import { collectModetourProductCore, parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { collectModetourRegisterFacts } from '@/lib/register-facts/modetour'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import { finalizeModetourRegisterParsedShopping } from '@/lib/register-modetour-shopping'

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

export type ModetourRegisterDetailAugmentCtx = {
  originUrl?: string | null
  pastedBlocks?: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping'>> | null
}

function modetourB2cHeaders(referer: string, productNo: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    referer,
    'x-platform': 'ModeEcommerce',
    'x-salespartner': '2',
    'x-userdepartment': 'ModeEcommerce',
    'x-incomming-pathname': `/package/${productNo}`,
    modewebapireqheader: MODETOUR_WEB_API_REQ_HEADER,
  }
}

async function fetchModetourKeyPointInfo(productNo: string, referer: string): Promise<Record<string, unknown> | null> {
  const base = MODETOUR_API_BASE.replace(/\/$/, '')
  const res = await fetch(`${base}/Package/GetProductKeyPointInfo?productNo=${encodeURIComponent(productNo)}`, {
    headers: modetourB2cHeaders(referer, productNo),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) return null
  const j = (await res.json()) as { result?: Record<string, unknown> }
  return j.result ?? null
}

function stripScheduleLabel(name: string): string {
  return name.replace(/^[\s▶■◎●#]+/, '').replace(/\s+/g, ' ').trim()
}

export function modetourFactDaysToRegisterSchedule(days: RegisterFactScheduleDay[]): RegisterScheduleDay[] {
  return days.map((d) => {
    const title = stripScheduleLabel(d.places[0] ?? d.hotels[0] ?? '') || `${d.day}일차`
    const descParts = [...d.places, d.transportNote].filter(Boolean) as string[]
    const description = descParts.map(stripScheduleLabel).join('\n') || title
    const routeText = d.places.length > 0 ? d.places.map(stripScheduleLabel).join(' - ') : null
    const hotelText = d.hotels.length > 0 ? d.hotels.join(' / ') : null
    const breakfast = d.meals.find((m) => /조식|아침/.test(m)) ?? null
    const lunch = d.meals.find((m) => /중식|점심/.test(m)) ?? null
    const dinner = d.meals.find((m) => /석식|저녁/.test(m)) ?? null
    return {
      day: d.day,
      title,
      description,
      routeText,
      imageKeyword: stripScheduleLabel(d.places[0] ?? title).slice(0, 80) || `${d.day}일차`,
      hotelText,
      breakfastText: breakfast,
      lunchText: lunch,
      dinnerText: dinner,
      mealSummaryText: d.meals.length > 0 ? d.meals.join(' / ') : null,
    }
  })
}

function bulletLinesFromText(raw: string | null | undefined): string[] {
  const t = (raw ?? '').trim()
  if (!t) return []
  return t
    .split(/\r?\n/)
    .map((l) => l.replace(/^[\s•·▪▶\-–—\d]+[.)]\s*/, '').trim())
    .filter((l) => l.length > 1 && l.length < 400)
}

function extractFeeLinesFromExcluded(excludedText: string): {
  singleRoomSurchargeRaw: string | null
  guideTipRaw: string | null
  visaRaw: string | null
} {
  const lines = bulletLinesFromText(excludedText)
  let singleRoomSurchargeRaw: string | null = null
  let guideTipRaw: string | null = null
  let visaRaw: string | null = null
  for (const line of lines) {
    if (!singleRoomSurchargeRaw && /(싱글|1인\s*객실|객실\s*1인|싱글룸|룸\s*사용)/i.test(line)) {
      singleRoomSurchargeRaw = line
    }
    if (!guideTipRaw && /(가이드|기사).*(경비|팁|비용)/i.test(line)) {
      guideTipRaw = line
    }
    if (!visaRaw && /(비자|visa)/i.test(line)) {
      visaRaw = line
    }
  }
  return { singleRoomSurchargeRaw, guideTipRaw, visaRaw }
}

function parseSingleRoomAmount(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*원/)
  if (!m) return null
  const n = Number(m[1]!.replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function buildKeyPointMustKnow(keyPoint: Record<string, unknown> | null): RegisterParsed['mustKnowItems'] {
  if (!keyPoint) return undefined
  const items: NonNullable<RegisterParsed['mustKnowItems']> = []
  const push = (category: '안전/유의' | '현지준비' | '입국/비자', title: string, body: string) => {
    const b = body.trim()
    if (!b) return
    items.push({ category, title, body: b, raw: b })
  }
  const score = String(keyPoint.productScore ?? '').trim()
  if (score && score !== '상품 핵심 포인트') push('안전/유의', '상품 핵심 포인트', score)
  const leader = String(keyPoint.leaderGuild ?? '').trim()
  const leaderStatus = String(keyPoint.leaderStatus ?? '').trim()
  if (leader) push('현지준비', '인솔자/가이드', [leader, leaderStatus].filter(Boolean).join(' · '))
  const insurance = String(keyPoint.travelerInsuranceInfo ?? '').trim()
  if (insurance) push('안전/유의', '여행자 보험', insurance)
  const guarantee = String(keyPoint.businessGuarantee ?? '').trim()
  if (guarantee) push('안전/유의', '공제/보증', guarantee)
  const mile = String(keyPoint.tourMile ?? '').trim()
  if (mile) push('현지준비', '투어 마일리지', mile)
  return items.length > 0 ? items : undefined
}

function hasOptionalPaste(ctx?: ModetourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.optionalTour?.trim())
}

function hasShoppingPaste(ctx?: ModetourRegisterDetailAugmentCtx): boolean {
  return Boolean(ctx?.pastedBlocks?.shopping?.trim())
}

function hasStructuredOptional(parsed: RegisterParsed): boolean {
  const raw = parsed.optionalToursStructured
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

function hasStructuredShopping(parsed: RegisterParsed): boolean {
  const raw = parsed.shoppingStops
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

export function needsModetourScheduleCollect(parsed: RegisterParsed): boolean {
  const rows = parsed.schedule ?? []
  if (rows.length === 0) return true
  return rows.every((d) => !d.title?.trim() && !d.description?.trim())
}

export function needsModetourIncludedExcludedCollect(parsed: RegisterParsed): boolean {
  const hasIncl = (parsed.includedItems?.length ?? 0) > 0 || Boolean(parsed.includedText?.trim())
  const hasExcl = (parsed.excludedItems?.length ?? 0) > 0 || Boolean(parsed.excludedText?.trim())
  return !hasIncl && !hasExcl
}

export function needsModetourMustKnowCollect(parsed: RegisterParsed): boolean {
  return (parsed.mustKnowItems?.length ?? 0) === 0 && !parsed.mustKnowRaw?.trim()
}

export async function augmentModetourParsedWithDetailCollect(
  parsed: RegisterParsed,
  ctx?: ModetourRegisterDetailAugmentCtx,
): Promise<RegisterParsed> {
  const originUrl = (ctx?.originUrl ?? '').trim()
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!originUrl || !productNo || productNo === '0') return parsed

  const needSchedule = needsModetourScheduleCollect(parsed)
  const needInclExcl = needsModetourIncludedExcludedCollect(parsed)
  const needMustKnow = needsModetourMustKnowCollect(parsed)
  const needOpt = !hasOptionalPaste(ctx?.pastedBlocks) && !hasStructuredOptional(parsed)
  const needShop =
    !hasShoppingPaste(ctx?.pastedBlocks) &&
    !hasStructuredShopping(parsed) &&
    parsed.shoppingVisitCount == null

  if (!needSchedule && !needInclExcl && !needMustKnow && !needOpt && !needShop) return parsed

  const referer = originUrl
  const summaryParts: string[] = []
  let next: RegisterParsed = { ...parsed }

  const [facts, core, keyPoint] = await Promise.all([
    needSchedule ? collectModetourRegisterFacts(originUrl) : Promise.resolve(null),
    needInclExcl || needOpt || needShop ? collectModetourProductCore(originUrl) : Promise.resolve(null),
    needMustKnow ? fetchModetourKeyPointInfo(productNo, referer) : Promise.resolve(null),
  ])

  if (needSchedule && facts?.scheduleDays.length) {
    const scheduleDays = modetourFactDaysToRegisterSchedule(facts.scheduleDays)
    if (scheduleDays.length > 0) {
      next = { ...next, schedule: scheduleDays }
      summaryParts.push(`GetScheduleList: 일정 ${scheduleDays.length}일차`)
    }
  }

  const product = core?.product
  if (needInclExcl && product) {
    const inclItems = bulletLinesFromText(product.includedText)
    const exclItems = bulletLinesFromText(product.excludedText)
    const fees = extractFeeLinesFromExcluded(product.excludedText ?? '')
    if (inclItems.length > 0 || product.includedText) {
      next = {
        ...next,
        includedItems: inclItems.length > 0 ? inclItems : next.includedItems,
        includedText: product.includedText ?? next.includedText,
        includedRaw: product.includedText ?? next.includedRaw,
      }
    }
    if (exclItems.length > 0 || product.excludedText) {
      const mergedExcl = [...exclItems]
      for (const extra of [fees.singleRoomSurchargeRaw, fees.guideTipRaw, fees.visaRaw]) {
        if (extra && !mergedExcl.some((x) => x.includes(extra.slice(0, 20)))) mergedExcl.push(extra)
      }
      next = {
        ...next,
        excludedItems: mergedExcl.length > 0 ? mergedExcl : next.excludedItems,
        excludedText: product.excludedText ?? next.excludedText,
        excludedRaw: product.excludedText ?? next.excludedText,
        criticalExclusions: product.criticalExclusions ?? next.criticalExclusions,
      }
    }
    if (fees.singleRoomSurchargeRaw) {
      const amt = parseSingleRoomAmount(fees.singleRoomSurchargeRaw)
      next = {
        ...next,
        singleRoomSurchargeRaw: fees.singleRoomSurchargeRaw,
        singleRoomSurchargeDisplayText: fees.singleRoomSurchargeRaw,
        hasSingleRoomSurcharge: true,
        ...(amt != null
          ? { singleRoomSurchargeAmount: amt, singleRoomSurchargeCurrency: 'KRW' as const }
          : {}),
      }
    }
    if (product.mandatoryLocalFee != null) {
      next = {
        ...next,
        mandatoryLocalFee: product.mandatoryLocalFee,
        mandatoryCurrency: product.mandatoryCurrency ?? next.mandatoryCurrency,
      }
    }
    if (inclItems.length > 0 || exclItems.length > 0) {
      summaryParts.push(`상세HTML: 포함 ${inclItems.length}·불포함 ${exclItems.length}항`)
    }
  }

  if (needShop && product?.shoppingVisitCountTotal != null) {
    next = {
      ...next,
      shoppingVisitCount: product.shoppingVisitCountTotal,
      hasShopping: product.shoppingVisitCountTotal > 0,
      ...(product.noShoppingFlag === true ? { hasShopping: false, shoppingVisitCount: 0 } : {}),
    }
    next = finalizeModetourRegisterParsedShopping(next)
    summaryParts.push(`상세HTML: 쇼핑 ${product.shoppingVisitCountTotal}회`)
  }

  if (needOpt && product) {
    if (product.hasOptionalTours === true && product.optionalTourSummaryRaw) {
      next = {
        ...next,
        hasOptionalTour: true,
        optionalTourSummaryText: product.optionalTourSummaryRaw.slice(0, 280),
      }
      summaryParts.push('상세HTML: 선택관광 요약')
    } else if (product.noOptionFlag === true || product.hasOptionalTours === false) {
      next = { ...next, hasOptionalTour: false, optionalTourCount: 0 }
    }
  }

  if (needMustKnow) {
    const mustKnowItems = buildKeyPointMustKnow(keyPoint)
    if (mustKnowItems?.length) {
      next = {
        ...next,
        mustKnowItems,
        mustKnowSource: 'supplier',
      }
      summaryParts.push(`GetProductKeyPointInfo: 핵심포인트 ${mustKnowItems.length}건`)
    }
  }

  const notes = [...(next.registerPreviewPolicyNotes ?? [])]
  const note =
    summaryParts.length > 0
      ? `모두투어 상세카드 자동수집: ${summaryParts.join(' · ')}`
      : '모두투어 상세카드 자동수집: 해당 축 데이터 없음(붙여넣기·LLM 우선)'
  if (!notes.includes(note)) notes.push(note)

  return {
    ...next,
    modetourDetailCollectRan: summaryParts.length > 0,
    modetourDetailCollectSummary: summaryParts.join(' · ') || '스킵 또는 0건',
    registerPreviewPolicyNotes: notes,
  }
}
