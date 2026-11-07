/**
 * 패키지 등록대기 — 공급사 원문 재수집으로 일정 title/description/routeText 재구성.
 * heal/remat 파이프라인에서만 사용. Product.title·가격 미변경. FIT 미사용.
 * pending / pre_photo_blocked 만.
 */
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { naeiltourFactDaysToRegisterSchedule } from '@/lib/naeiltour-register-api-schedule'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { prisma } from '@/lib/prisma'
import { isBrokenRegisterScheduleDescription } from '@/lib/register-pre-photo-guards'
import { REGISTER_PRE_PHOTO_BLOCKED_STATUS } from '@/lib/register-pre-photo-pending-queue'
import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { isScheduleSupplierOriginalLocked } from '@/lib/schedule-supplier-original-lock'
import {
  fixDepartureTemplateSentence,
  registerScheduleDepartureHub,
} from '@/lib/register-schedule-day-summary-finalize'
import {
  commitPendingOnlyProductScheduleWrite,
  parseProductRawMeta,
  stampRematRevisionOnRawMeta,
} from '@/lib/register-pending-write-guard'

const PACKAGE_SUPPLIER_REMAT_META_KEY = 'packageSupplierScheduleRemat'

export type PackageSupplierRematerializeResult = {
  productId: string
  updated: boolean
  reason:
    | 'ok'
    | 'skipped_locked'
    | 'skipped_status'
    | 'skipped_no_origin'
    | 'skipped_supplier'
    | 'skipped_not_thin'
    | 'facts_missing'
    | 'schedule_empty'
    | 'product_missing'
    | 'aborted_race'
}

const KR_DEPARTURE_HUB_RE = /^(인천|김포|김해|부산|대구|청주|제주|무안|양양)/u
const normHub = (h: string) => (h === '김해' ? '부산' : h)

/**
 * 문과장 1106: 원문 출발지(상품 제목 + 1일차 원문 헤더/교통)로만 출발·귀국 틀 문장을 고친다.
 * 원문 출발지가 없거나 서로 다르면(예: 헤더 인천 vs 제목 [부산출발]) 틀 문장을 지우고 지어내지 않는다.
 */
export function resolveSourceDepartureHub(
  productTitle: string | null | undefined,
  day1: import('@/lib/register-facts/types').RegisterFactScheduleDay | undefined,
): string | null {
  const hubs = new Set<string>()
  const fromTitle = registerScheduleDepartureHub(String(productTitle ?? ''), '')
  if (fromTitle) hubs.add(normHub(fromTitle))
  const first = String(day1?.places?.[0] ?? '').trim()
  const m1 = KR_DEPARTURE_HUB_RE.exec(first)
  if (m1) hubs.add(normHub(m1[1]!))
  else {
    const seg = String(day1?.transportNote ?? '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.includes(' - '))
    const m2 = KR_DEPARTURE_HUB_RE.exec(String(seg ?? '').split(' - ')[0]!.trim())
    if (m2) hubs.add(normHub(m2[1]!))
  }
  return hubs.size === 1 ? [...hubs][0]! : null
}

/** 1일차 원문 교통 구간('출발 - 도착')의 도착 도시 — 출발 틀 문장 도착지 검증용(원문 값만) */
export function sourceDay1ArrivalCities(
  day1: import('@/lib/register-facts/types').RegisterFactScheduleDay | undefined,
): string[] {
  return String(day1?.transportNote ?? '')
    .split(';')
    .map((x) => x.trim())
    .filter((x) => x.includes(' - '))
    .map((x) => x.split(' - ').slice(-1)[0]!.trim())
    .filter((x) => x.length >= 2 && x.length <= 20)
}

export function applySourceDepartureHubToScheduleRows<T extends { day: number; description?: string | null }>(
  rows: T[],
  hub: string | null,
  knownArrivalCities: readonly string[] = [],
): T[] {
  const maxDay = rows.reduce((m, r) => Math.max(m, Number(r.day) || 0), 0)
  return rows.map((r) => {
    const day = Number(r.day) || 0
    if (day !== 1 && !(maxDay >= 2 && day === maxDay)) return r
    const desc = String(r.description ?? '').trim()
    if (!desc) return r
    const sents = desc.split(/(?<=[.!?])\s+/u).map((x) => x.trim()).filter(Boolean)
    const fixed = sents.map((x) => fixDepartureTemplateSentence(x, hub, knownArrivalCities)).filter((x): x is string => Boolean(x))
    const next = fixed.join(' ').trim() || `${day}일차`
    return next === desc ? r : { ...r, description: next }
  })
}

/** 템플릿·빈 제목·빈 요약이 일정에 남아 공급사 재수집이 필요한지 */
export function registerPrePhotoPackageScheduleLooksThin(
  rows: readonly {
    day?: number | null
    title?: string | null
    description?: string | null
    routeText?: string | null
  }[],
): boolean {
  const days = rows.filter((r) => Number(r.day) > 0)
  if (days.length < 1) return true
  let thin = 0
  for (const row of days) {
    const title = String(row.title ?? '').trim()
    const desc = String(row.description ?? '').trim()
    const route = row.routeText
    if (!title || /^(\d+)\s*일차$/.test(title)) {
      thin += 1
      continue
    }
    if (isBrokenRegisterScheduleDescription(desc, route)) {
      thin += 1
      continue
    }
    // 도시 영문만·characteristic closer 반복
    if (
      /첫날 리듬을 맞추며|주변을 이어서 둘러봅니다|일정을 이어갑니다/.test(desc) &&
      (!route || splitRouteLen(route) <= 1)
    ) {
      thin += 1
    }
  }
  return thin >= Math.max(1, Math.ceil(days.length * 0.35))
}

function splitRouteLen(routeText: string | null | undefined): number {
  return String(routeText ?? '')
    .split(/\s*-\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2).length
}

function factDaysToSchedule(
  supplier: CanonicalOverseasSupplierKey,
  days: import('@/lib/register-facts/types').RegisterFactScheduleDay[],
  productTitle: string | null,
) {
  switch (supplier) {
    case 'modetour':
      return modetourFactDaysToRegisterSchedule(days, { productTitle })
    case 'hanatour':
      return hanatourFactDaysToRegisterSchedule(days)
    case 'naeiltour':
      return naeiltourFactDaysToRegisterSchedule(days)
    default:
      return null
  }
}

/**
 * originUrl에서 사실 재수집 → 일정 행만 교체(호텔·식사 기존 값 유지 가능 시 병합).
 * title/price 컬럼은 건드리지 않음.
 */
export async function rematerializePackageScheduleFromSupplierFacts(
  productId: string,
  opts?: { force?: boolean },
): Promise<PackageSupplierRematerializeResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      originUrl: true,
      originSource: true,
      originCode: true,
      schedule: true,
      rawMeta: true,
      registrationStatus: true,
    },
  })
  if (!product) return { productId, updated: false, reason: 'product_missing' }
  const status = String(product.registrationStatus ?? '')
  if (status !== 'pending' && status !== REGISTER_PRE_PHOTO_BLOCKED_STATUS) {
    return { productId, updated: false, reason: 'skipped_status' }
  }
  if (isScheduleSupplierOriginalLocked(product.rawMeta)) {
    return { productId, updated: false, reason: 'skipped_locked' }
  }
  const originUrl = String(product.originUrl ?? '').trim()
  if (!originUrl) return { productId, updated: false, reason: 'skipped_no_origin' }

  let scheduleArr: Array<Record<string, unknown>> = []
  try {
    scheduleArr = JSON.parse(String(product.schedule ?? '[]')) as Array<Record<string, unknown>>
  } catch {
    scheduleArr = []
  }
  if (!opts?.force && !registerPrePhotoPackageScheduleLooksThin(scheduleArr as never)) {
    return { productId, updated: false, reason: 'skipped_not_thin' }
  }

  const supplier = normalizeSupplierOrigin(String(product.originSource ?? '')) as CanonicalOverseasSupplierKey | null
  if (!supplier || !['modetour', 'hanatour', 'naeiltour'].includes(supplier)) {
    return { productId, updated: false, reason: 'skipped_supplier' }
  }

  const bundle = await collectSupplierRegisterFacts(supplier, originUrl, {
    originCode: product.originCode,
  })
  if (!bundle?.scheduleDays?.length) {
    return { productId, updated: false, reason: 'facts_missing' }
  }
  const built0 = factDaysToSchedule(supplier, bundle.scheduleDays, product.title)
  if (!built0?.length) return { productId, updated: false, reason: 'schedule_empty' }
  const hub = resolveSourceDepartureHub(product.title, bundle.scheduleDays.find((d) => Number(d.day) === 1))
  // 같은 일차 중복 행은 첫 행만 (Map 마지막-승리로 footer 묻은 행 채택 방지)
  const seenBuilt = new Set<number>()
  const built = applySourceDepartureHubToScheduleRows(built0, hub, sourceDay1ArrivalCities(bundle.scheduleDays.find((d) => Number(d.day) === 1))).filter((r) => {
    const d = Number(r.day)
    if (seenBuilt.has(d)) return false
    seenBuilt.add(d)
    return true
  })

  const byDay = new Map(built.map((r) => [Number(r.day), r]))
  const baseRows: Array<Record<string, unknown>> = scheduleArr.length
    ? scheduleArr
    : built.map((r) => ({ day: r.day }) as Record<string, unknown>)
  const next: Array<Record<string, unknown>> = baseRows.map((row) => {
    const day = Number(row.day) || 0
    const u = byDay.get(day)
    if (!u) return row
    return {
      ...row,
      title: u.title ?? row.title,
      description: u.description ?? row.description,
      routeText: u.routeText ?? row.routeText,
      hotelText: u.hotelText ?? row.hotelText,
      breakfastText: u.breakfastText ?? row.breakfastText,
      lunchText: u.lunchText ?? row.lunchText,
      dinnerText: u.dinnerText ?? row.dinnerText,
      mealSummaryText: u.mealSummaryText ?? row.mealSummaryText,
    }
  })
  for (const u of built) {
    if (!next.some((r) => Number(r.day) === Number(u.day))) {
      next.push({ ...(u as unknown as Record<string, unknown>) })
    }
  }
  next.sort((a, b) => Number(a.day) - Number(b.day))

  const scheduleJson = JSON.stringify(next)
  const rawMeta = stampRematRevisionOnRawMeta(parseProductRawMeta(product.rawMeta), scheduleJson, {
    [PACKAGE_SUPPLIER_REMAT_META_KEY]: {
      at: new Date().toISOString(),
      supplier,
      days: built.length,
    },
  })

  // collect 이후 재확인: registered 전환·타 워커 동시 쓰기면 count≠1 → 중단(사진 upstream 금지)
  const commit = await commitPendingOnlyProductScheduleWrite({
    productId,
    expectedSchedule: product.schedule,
    nextSchedule: scheduleJson,
    nextRawMeta: JSON.stringify(rawMeta),
    expectedRawMeta: product.rawMeta,
  })
  if (!commit.ok) {
    if (commit.reason === 'aborted_status') return { productId, updated: false, reason: 'skipped_status' }
    if (commit.reason === 'aborted_lock') return { productId, updated: false, reason: 'skipped_locked' }
    return { productId, updated: false, reason: 'aborted_race' }
  }
  return { productId, updated: true, reason: 'ok' }
}
