/**
 * 한진관광 수집 → 등록대기 upsert.
 * 진입은 지역 필터(선정만)와 출발일·원문 성인 요금 검사를 거친 뒤에만 쓴다.
 * registrationStatus 는 pending 만 기록한다. 공개(registered)로 바꾸는 분기는 없다.
 * 가격은 파서가 남긴 양의 정수만 저장하고, 없는 아동·유아 요금을 성인가로 채우지 않는다.
 * REGRESSION-FREEZE[hanjintour-register-pending-only]: 등록대기 전용·원문 정수 가격 — manifest
 */
import type { Prisma, PrismaClient } from '@prisma/client'
import {
  buildExistingRegionIndex,
  classifyHanjintourListing,
  hanjintourDetailCollectAllowed,
  type ExistingProductRegionRow,
} from '@/lib/hanjintour-region-filter'
import {
  hanjintourShouldEnqueuePending,
  type HanjintourDeparture,
  type HanjintourScheduleDay,
} from '@/lib/hanjintour-parse'
import { HANJINTOUR_SUPPLIER_KEY } from '@/lib/hanjintour-supplier-key'
import { computeDepartureSlotKeyFromDate } from '@/lib/departure-slot-key'

export const HANJINTOUR_PENDING_STATUS = 'pending' as const

export type HanjintourRegisterInput = {
  gdsNo: string
  title: string
  categoryPaths: string[][]
  departures: HanjintourDeparture[]
  days?: HanjintourScheduleDay[]
  existingRows: ExistingProductRegionRow[]
  todayIso?: string
  duration?: string | null
  originUrl?: string | null
}

export type HanjintourSkipReason = 'missing_code' | 'not_selected' | 'no_departure' | 'bad_price' | 'already_public'

export type HanjintourDepartureWrite = {
  date: string
  adultPrice: number
  childBedPrice: number | null
  infantPrice: number | null
  statusRaw: string | null
  evtNo: string
  airline: string | null
}

export type HanjintourPendingPlan = {
  ok: true
  originSource: typeof HANJINTOUR_SUPPLIER_KEY
  originCode: string
  title: string
  registrationStatus: typeof HANJINTOUR_PENDING_STATUS
  scheduleJson: string
  priceFrom: number
  airline: string | null
  duration: string | null
  originUrl: string | null
  departures: HanjintourDepartureWrite[]
  basis: string
}

export type HanjintourRegisterPlan = HanjintourPendingPlan | { ok: false; reason: HanjintourSkipReason; basis?: string }

function originalPositiveInt(n: number | null | undefined): number | null | 'bad' {
  if (n == null) return null
  if (typeof n !== 'number' || !Number.isInteger(n) || n <= 0) return 'bad'
  return n
}

function scheduleJson(days: HanjintourScheduleDay[] | undefined): string {
  const rows = (days ?? []).map((d) => ({
    day: d.day,
    description: d.descriptions.join('\n'),
    cities: d.cities,
    spots: d.spots,
    hotels: d.hotels,
    meals: d.meals,
  }))
  return JSON.stringify(rows)
}

/**
 * 수집 진입점. 지역 필터를 통과하고, 오늘 이후 원문 성인 요금이 있는 출발일이 있을 때만 pending 계획을 만든다.
 */
export function planHanjintourPendingEnqueue(input: HanjintourRegisterInput): HanjintourRegisterPlan {
  const originCode = String(input.gdsNo ?? '').trim()
  const title = String(input.title ?? '').trim()
  if (!originCode || !title) return { ok: false, reason: 'missing_code' }

  const decision = classifyHanjintourListing(
    { gdsNo: originCode, title, categoryPaths: input.categoryPaths ?? [] },
    buildExistingRegionIndex(input.existingRows ?? []),
  )
  if (!hanjintourDetailCollectAllowed(decision)) {
    return { ok: false, reason: 'not_selected', basis: decision.basis }
  }

  const todayIso = input.todayIso ?? new Date().toISOString().slice(0, 10)
  if (!hanjintourShouldEnqueuePending({ departures: input.departures ?? [] }, todayIso)) {
    return { ok: false, reason: 'no_departure', basis: decision.basis }
  }

  const departures: HanjintourDepartureWrite[] = []
  for (const d of input.departures ?? []) {
    if (!d.date || d.date < todayIso) continue
    const adult = originalPositiveInt(d.adultPrice)
    if (adult === 'bad') return { ok: false, reason: 'bad_price', basis: decision.basis }
    if (adult == null) continue
    const child = originalPositiveInt(d.childPrice)
    const infant = originalPositiveInt(d.infantPrice)
    if (child === 'bad' || infant === 'bad') return { ok: false, reason: 'bad_price', basis: decision.basis }
    departures.push({
      date: d.date,
      adultPrice: adult,
      childBedPrice: child,
      infantPrice: infant,
      statusRaw: d.status,
      evtNo: d.evtNo,
      airline: d.airline ?? null,
    })
  }
  if (departures.length === 0) return { ok: false, reason: 'no_departure', basis: decision.basis }

  const priceFrom = Math.min(...departures.map((d) => d.adultPrice))
  return {
    ok: true,
    originSource: HANJINTOUR_SUPPLIER_KEY,
    originCode,
    title,
    registrationStatus: HANJINTOUR_PENDING_STATUS,
    scheduleJson: scheduleJson(input.days),
    priceFrom,
    airline: departures.find((d) => d.airline)?.airline ?? null,
    duration: input.duration ?? null,
    originUrl: input.originUrl?.trim() || null,
    departures,
    basis: decision.basis,
  }
}

function departureDate(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`)
}

/**
 * pending 계획만 쓴다. 이미 공개된 행은 가격·상태 모두 건드리지 않는다.
 */
export async function applyHanjintourPendingPlan(
  prisma: PrismaClient,
  plan: HanjintourRegisterPlan,
): Promise<{ ok: true; productId: string; registrationStatus: typeof HANJINTOUR_PENDING_STATUS } | { ok: false; reason: HanjintourSkipReason }> {
  if (!plan.ok) return plan
  if (plan.registrationStatus !== HANJINTOUR_PENDING_STATUS || plan.originSource !== HANJINTOUR_SUPPLIER_KEY) {
    return { ok: false, reason: 'not_selected' }
  }

  const existing = await prisma.product.findUnique({
    where: { originSource_originCode: { originSource: plan.originSource, originCode: plan.originCode } },
    select: { id: true, registrationStatus: true },
  })
  if (existing?.registrationStatus === 'registered') return { ok: false, reason: 'already_public' }

  const data = {
    originSource: plan.originSource,
    originCode: plan.originCode,
    title: plan.title,
    originalTitle: plan.title,
    registrationStatus: HANJINTOUR_PENDING_STATUS,
    schedule: plan.scheduleJson,
    priceFrom: plan.priceFrom,
    priceCurrency: 'KRW',
    airline: plan.airline,
    duration: plan.duration,
    originUrl: plan.originUrl,
  }

  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data, select: { id: true } })
    : await prisma.product.create({ data, select: { id: true } })

  for (const row of plan.departures) {
    const departureDateValue = departureDate(row.date)
    const departureSlotKey = computeDepartureSlotKeyFromDate(departureDateValue, null, row.evtNo)
    const create: Prisma.ProductDepartureUncheckedCreateInput = {
      productId: product.id,
      departureDate: departureDateValue,
      departureSlotKey,
      adultPrice: row.adultPrice,
      childBedPrice: row.childBedPrice,
      infantPrice: row.infantPrice,
      statusRaw: row.statusRaw,
      supplierDepartureCodeCandidate: row.evtNo,
      carrierName: row.airline,
    }
    const update: Prisma.ProductDepartureUncheckedUpdateInput = {
      adultPrice: row.adultPrice,
      statusRaw: row.statusRaw,
      supplierDepartureCodeCandidate: row.evtNo,
      carrierName: row.airline,
      ...(row.childBedPrice != null ? { childBedPrice: row.childBedPrice } : {}),
      ...(row.infantPrice != null ? { infantPrice: row.infantPrice } : {}),
    }
    await prisma.productDeparture.upsert({
      where: { productId_departureSlotKey: { productId: product.id, departureSlotKey } },
      create,
      update,
    })
  }

  return { ok: true, productId: product.id, registrationStatus: HANJINTOUR_PENDING_STATUS }
}
