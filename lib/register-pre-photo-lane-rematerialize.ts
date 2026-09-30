/**
 * 등록 전 사진 verify 실패(중간일 키워드 공란 등) — 레인별 SSOT로 다시 만든다.
 *
 * - FIT(`air_hotel_free`): Fit 추천일정(master) → schedule 동선·imageKeyword.
 *   master 없으면 Gemini로 생성 후 동기화.
 * - 패키지: 규칙 키워드 → (자유일정) 추천일정 Gemini → 빈 관광일 Gemini → heal.
 *
 * REGRESSION-FREEZE[register-pre-photo-lane-rematerialize]: FIT·패키지 레인별 remat — manifest
 */
import { isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'
import { generateFitItineraryForProduct } from '@/lib/fit-itinerary-generate-for-product'
import {
  syncScheduleImageKeywordsFromFitMasterDb,
} from '@/lib/fit-itinerary-sync-schedule-image-keywords'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { prisma } from '@/lib/prisma'
import { boostWeakAirtelScheduleImageKeywordsFromRouteText } from '@/lib/register-airtel-route-image-keyword'
import { resolveRegisterAdminLane } from '@/lib/register-admin-lane'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import {
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhotoForStoredProduct,
  type RegisterPrePhotoVerifyIssue,
} from '@/lib/register-pre-photo-verify'
import { fillRegisterScheduleImageKeywordsWithGeminiIfNeeded } from '@/lib/register-schedule-image-keyword-gemini-fill'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

export type RegisterPrePhotoLaneRematerializeResult = {
  productId: string
  lane: 'air_hotel_free' | 'package' | 'theme' | string
  path: 'fit_sync_master' | 'fit_generate' | 'package_rules_gemini' | 'skipped'
  updated: boolean
  beforeIssues: RegisterPrePhotoVerifyIssue[]
  afterIssues: RegisterPrePhotoVerifyIssue[]
  ok: boolean
}

function productSelectForRemat() {
  return {
    id: true,
    title: true,
    destination: true,
    primaryDestination: true,
    countryKey: true,
    originSource: true,
    schedule: true,
    listingKind: true,
    productType: true,
    sportsThemeTag: true,
    includedText: true,
    rawMeta: true,
    registrationStatus: true,
  } as const
}

async function persistHealedSchedule(
  productId: string,
  scheduleJson: string | null | undefined,
  healedRows: Array<{
    day: number
    title?: string | null
    description?: string | null
    routeText?: string | null
    imageKeyword?: string | null
    imageKeyword2?: string | null
  }>,
): Promise<void> {
  let scheduleArr: unknown[] = []
  try {
    scheduleArr = JSON.parse(String(scheduleJson ?? '[]')) as unknown[]
  } catch {
    scheduleArr = []
  }
  const byDay = new Map(healedRows.map((r) => [Number(r.day), r]))
  const next = (Array.isArray(scheduleArr) ? scheduleArr : []).map((item) => {
    const row = item as Record<string, unknown>
    const day = Number(row.day) || 0
    const u = byDay.get(day)
    if (!u) return row
    return {
      ...row,
      imageKeyword:
        u.imageKeyword !== undefined && u.imageKeyword !== null ? u.imageKeyword : row.imageKeyword,
      imageKeyword2: Object.prototype.hasOwnProperty.call(u, 'imageKeyword2')
        ? u.imageKeyword2
        : row.imageKeyword2,
      description: u.description ?? row.description,
      routeText: u.routeText ?? row.routeText,
      title: u.title ?? row.title,
    }
  })
  // FIT sync가 새 일차를 넣었는데 원 schedule에 없으면 병합
  for (const h of healedRows) {
    const day = Number(h.day)
    if (!next.some((r) => Number((r as { day?: unknown }).day) === day)) {
      next.push({
        day,
        title: h.title ?? `Day ${day}`,
        description: h.description ?? '',
        routeText: h.routeText ?? null,
        imageKeyword: h.imageKeyword ?? '',
        imageKeyword2: h.imageKeyword2 ?? null,
      })
    }
  }
  next.sort((a, b) => Number((a as { day: number }).day) - Number((b as { day: number }).day))
  await prisma.product.update({
    where: { id: productId },
    data: { schedule: JSON.stringify(next) },
  })
}

async function rematerializeFitLane(
  productId: string,
  beforeIssues: RegisterPrePhotoVerifyIssue[],
): Promise<RegisterPrePhotoLaneRematerializeResult> {
  let path: RegisterPrePhotoLaneRematerializeResult['path'] = 'fit_sync_master'
  let updated = false

  const synced = await syncScheduleImageKeywordsFromFitMasterDb(productId)
  if (synced.hadMaster) {
    updated = synced.updated
  } else {
    path = 'fit_generate'
    const gen = await generateFitItineraryForProduct(productId)
    updated = Boolean(gen.success)
    if (!gen.success && gen.reason === 'already_exists') {
      const again = await syncScheduleImageKeywordsFromFitMasterDb(productId)
      updated = again.updated
      path = 'fit_sync_master'
    }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelectForRemat(),
  })
  if (!product) {
    return {
      productId,
      lane: 'air_hotel_free',
      path,
      updated: false,
      beforeIssues,
      afterIssues: beforeIssues,
      ok: false,
    }
  }

  const supplierKey = normalizeSupplierOrigin(String(product.originSource ?? '')) || 'etc'
  let rows = scheduleRowsForPrePhotoVerify(product.schedule)
  rows = boostWeakAirtelScheduleImageKeywordsFromRouteText(rows as never) as typeof rows
  const healed = healRegisterPrePhotoSchedule(rows, {
    supplierKey,
    productDestination: product.primaryDestination ?? product.destination,
    productTitle: product.title,
    lane: 'air_hotel_free',
    productHaystack: [product.includedText, String(product.rawMeta ?? '').slice(0, 8000)]
      .filter(Boolean)
      .join('\n'),
  })
  await persistHealedSchedule(productId, product.schedule, healed.rows)
  updated = true

  const after = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelectForRemat(),
  })
  const afterV = verifyRegisterPrePhotoForStoredProduct(after as never)
  const afterIssues = afterV.ok ? [] : afterV.issues || []
  return {
    productId,
    lane: 'air_hotel_free',
    path,
    updated,
    beforeIssues,
    afterIssues,
    ok: afterV.ok,
  }
}

async function rematerializePackageLane(
  productId: string,
  beforeIssues: RegisterPrePhotoVerifyIssue[],
): Promise<RegisterPrePhotoLaneRematerializeResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelectForRemat(),
  })
  if (!product) {
    return {
      productId,
      lane: 'package',
      path: 'skipped',
      updated: false,
      beforeIssues,
      afterIssues: beforeIssues,
      ok: false,
    }
  }

  const supplierKey = normalizeSupplierOrigin(String(product.originSource ?? '')) || 'etc'
  const dest = product.primaryDestination ?? product.destination
  const mapped = scheduleRowsForPrePhotoVerify(product.schedule)
  // title/description: ApplyRow는 null 불가 — HealRow null을 undefined로 정규화
  const allocated = applyRegisterScheduleImageKeywordsBySupplier(
    mapped.map((row) => ({
      day: Number(row.day) || 0,
      title: row.title != null ? String(row.title) : undefined,
      description: row.description != null ? String(row.description) : undefined,
      routeText: row.routeText ?? null,
      imageKeyword: row.imageKeyword ?? '',
      imageKeyword2: row.imageKeyword2 ?? null,
    })),
    {
      supplierKey,
      productDestination: dest,
      productTitle: product.title,
      travelScope: 'package',
    },
  )
  // REGRESSION-FREEZE[register-pre-photo-lane-rematerialize]: 패키지 자유일정 추천일정+빈칸 Gemini — manifest
  const withGemini = await fillRegisterScheduleImageKeywordsWithGeminiIfNeeded(allocated, {
    supplierKey,
    productDestination: dest,
    productTitle: product.title,
    logLabel: `lane-remat:${productId.slice(0, 8)}`,
  })
  const healed = healRegisterPrePhotoSchedule(withGemini, {
    supplierKey,
    productDestination: dest,
    productTitle: product.title,
    lane: 'package',
    productHaystack: [product.includedText, String(product.rawMeta ?? '').slice(0, 8000)]
      .filter(Boolean)
      .join('\n'),
  })
  await persistHealedSchedule(productId, product.schedule, healed.rows)

  const after = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelectForRemat(),
  })
  const afterV = verifyRegisterPrePhotoForStoredProduct(after as never)
  const afterIssues = afterV.ok ? [] : afterV.issues || []
  return {
    productId,
    lane: 'package',
    path: 'package_rules_gemini',
    updated: true,
    beforeIssues,
    afterIssues,
    ok: afterV.ok,
  }
}

/**
 * 저장된 상품 한 건 — 레인 SSOT로 일정 키워드(·FIT 추천일정)를 다시 만든다.
 */
export async function rematerializeRegisterPrePhotoByLane(
  productId: string,
): Promise<RegisterPrePhotoLaneRematerializeResult> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelectForRemat(),
  })
  if (!product) {
    return {
      productId,
      lane: 'package',
      path: 'skipped',
      updated: false,
      beforeIssues: [],
      afterIssues: ['product_missing'],
      ok: false,
    }
  }

  const beforeV = verifyRegisterPrePhotoForStoredProduct(product as never)
  const beforeIssues = beforeV.ok ? [] : beforeV.issues || []
  const lane = resolveRegisterAdminLane(product)

  if (lane === 'air_hotel_free' || isAirHotelFitItineraryProduct(product)) {
    return rematerializeFitLane(productId, beforeIssues)
  }

  return rematerializePackageLane(productId, beforeIssues)
}

/** remat 대상 이슈 — 키워드·동선 공란·own-route */
export function registerPrePhotoIssuesNeedLaneRematerialize(
  issues: readonly string[],
): boolean {
  return issues.some(
    (i) =>
      i.includes('bare_city_repeat') ||
      i.includes('middle_keyword_empty') ||
      i.includes('departure_keyword_empty') ||
      i.includes('not_on_own_route') ||
      i.includes('keyword2_bare_city') ||
      i.includes('middle_route_empty') ||
      i.includes('free_recommended_itinerary_missing') ||
      i.includes('fit_keyword_empty'),
  )
}
