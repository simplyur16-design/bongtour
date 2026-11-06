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
  const built = factDaysToSchedule(supplier, bundle.scheduleDays, product.title)
  if (!built?.length) return { productId, updated: false, reason: 'schedule_empty' }

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
  })
  if (!commit.ok) {
    if (commit.reason === 'aborted_status') return { productId, updated: false, reason: 'skipped_status' }
    if (commit.reason === 'aborted_lock') return { productId, updated: false, reason: 'skipped_locked' }
    return { productId, updated: false, reason: 'aborted_race' }
  }
  return { productId, updated: true, reason: 'ok' }
}
