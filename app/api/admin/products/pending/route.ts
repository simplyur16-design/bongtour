import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { computeAdminProductSupplierDerivatives } from '@/lib/admin-product-supplier-derivatives'
import { resolveRegisterAdminLane, registerAdminLaneLabel } from '@/lib/register-admin-lane'
import {
  readRegisterPrePhotoStampFromRawMeta,
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'
import { isRegisterPendingPhotosReady } from '@/lib/register-pending-photos-ready'
import { isRegisterPrePhotoPendingQueueReady } from '@/lib/register-pre-photo-pending-queue'
import {
  REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
} from '@/lib/register-pre-photo-pending-queue-query'

/**
 * GET /api/admin/products/pending
 * 등록대기 리스트: registrationStatus가 'pending'이거나 null/빈 문자열인 상품 중
 * 검증 통과(verify.ok)만. 검증 실패·파서 수정 필요는 올리지 않는다.
 * on_hold(보류), rejected(반려), pre_photo_blocked는 제외.
 * photosReady: 메인 이미지 + 일정 이미지가 모두 있으면 true.
 * REGRESSION-FREEZE[register-admin-lane-pre-photo]: 레인·검증 배지 — manifest
 * REGRESSION-FREEZE[pending-approve-photos-ready]: photosReady SSOT — manifest
 * REGRESSION-FREEZE[register-pre-photo-parser-fix]: verify.ok 만 등록대기 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 실패 건 큐 제외 — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: DB where SSOT — manifest
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const list = await prisma.product.findMany({
      where: REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
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
        bgImageUrl: true,
        schedule: true,
        primaryRegion: true,
        displayCategory: true,
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        rawMeta: true,
      },
    })
    const rows = list
      .map((p) => {
        const supplierDeriv = computeAdminProductSupplierDerivatives({
          brandKey: p.brand?.brandKey ?? null,
          originSource: p.originSource,
        })
        const lane = resolveRegisterAdminLane({
          listingKind: p.listingKind,
          productType: p.productType,
          sportsThemeTag: p.sportsThemeTag,
        })
        const live = verifyRegisterPrePhoto({
          lane,
          listingKind: p.listingKind,
          productType: p.productType,
          sportsThemeTag: p.sportsThemeTag,
          productDestination: p.destination,
          productTitle: p.title,
          rows: scheduleRowsForPrePhotoVerify(p.schedule),
        })
        if (!isRegisterPrePhotoPendingQueueReady(live)) return null
        const stamp = readRegisterPrePhotoStampFromRawMeta(p.rawMeta)
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
          photosReady: isRegisterPendingPhotosReady(p.bgImageUrl, p.schedule),
          primaryRegion: p.primaryRegion ?? null,
          displayCategory: p.displayCategory ?? null,
          registerLane: lane,
          registerLaneLabel: registerAdminLaneLabel(lane),
          prePhotoVerified: live.ok,
          prePhotoReadyForOperator: live.readyForOperatorPhoto,
          prePhotoParserFixRequired: live.parserFixRequired,
          prePhotoIssues: live.issues,
          prePhotoVerifiedAt: stamp?.verifiedAt ?? null,
        }
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
    return NextResponse.json(rows)
  } catch (e) {
    console.error('products/pending:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
