import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPrismaRetry } from '@/lib/prisma-retry'
import { requireAdmin } from '@/lib/require-admin'
import { computeAdminProductSupplierDerivatives } from '@/lib/admin-product-supplier-derivatives'
import { resolveRegisterAdminLane, registerAdminLaneLabel } from '@/lib/register-admin-lane'
import {
  REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE,
} from '@/lib/register-pre-photo-pending-queue-query'

export const maxDuration = 30

/**
 * GET /api/admin/products/pending
 * 등록대기 리스트: pending status + registerPrePhotoQueueReady 플래그 (schedule 전수 verify 없음).
 * on_hold(보류), rejected(반려), pre_photo_blocked·플래그 false는 제외.
 * photosReady: registerPhotosReady 캐시.
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 레인·검증 배지 — manifest
 * REGRESSION-FREEZE[pending-approve-photos-ready]: photosReady SSOT — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: verify.ok 만 등록대기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 실패 건 큐 제외 — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: DB where SSOT — manifest
 * REGRESSION-FREEZE[admin-pending-list-timeout]: rawMeta 제외·prisma retry — 15s 클라이언트 abort 금지 — manifest
 * REGRESSION-FREEZE[admin-pending-queue-flags]: list uses flag, no schedule — manifest
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const list = await withPrismaRetry('admin-products-pending', () =>
      prisma.product.findMany({
        where: REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          originCode: true,
          originSource: true,
          brand: { select: { brandKey: true } },
          title: true,
          destination: true,
          duration: true,
          updatedAt: true,
          primaryRegion: true,
          displayCategory: true,
          listingKind: true,
          productType: true,
          sportsThemeTag: true,
          countryKey: true,
          registerPhotosReady: true,
        },
      }),
    )
    const rows = list.map((p) => {
      const supplierDeriv = computeAdminProductSupplierDerivatives({
        brandKey: p.brand?.brandKey ?? null,
        originSource: p.originSource,
      })
      const lane = resolveRegisterAdminLane({
        listingKind: p.listingKind,
        productType: p.productType,
        sportsThemeTag: p.sportsThemeTag,
      })
      return {
        id: p.id,
        originCode: p.originCode,
        originSource: p.originSource,
        canonicalBrandKey: supplierDeriv.canonicalBrandKey,
        normalizedOriginSupplier: supplierDeriv.normalizedOriginSupplier,
        title: p.title,
        destination: p.destination,
        duration: p.duration,
        updatedAt: p.updatedAt,
        // REGRESSION-FREEZE[pending-approve-photos-ready]: registerPhotosReady cache (= isRegisterPendingPhotosReady) — manifest
        photosReady: Boolean(p.registerPhotosReady),
        primaryRegion: p.primaryRegion ?? null,
        displayCategory: p.displayCategory ?? null,
        countryKey: p.countryKey,
        registerLane: lane,
        registerLaneLabel: registerAdminLaneLabel(lane),
        // 플래그 큐 = write-path live verify.ok; 상세 이슈는 product detail
        prePhotoVerified: true,
        prePhotoReadyForOperator: true,
        prePhotoParserFixRequired: false,
        prePhotoIssues: [] as string[],
      }
    })
    return NextResponse.json(rows)
  } catch (e) {
    console.error('products/pending:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
