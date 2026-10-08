/**
 * 등록대기 큐 조회 — DB pending + registerPrePhotoQueueReady 플래그(쓰기·백필 SSOT).
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 대시보드=등록대기 화면 — manifest
 * REGRESSION-FREEZE[admin-pending-list-timeout]: KPI count도 prisma retry — manifest
 * REGRESSION-FREEZE[pending-pexels-pick-verify-parity]: 큐 검증은 title·dest 포함 공통 헬퍼 — manifest
 * REGRESSION-FREEZE[admin-pending-queue-flags]: count = flag, no schedule scan — manifest
 */
import { prisma } from '@/lib/prisma'
import { withPrismaRetry } from '@/lib/prisma-retry'
import type { Prisma } from '@prisma/client'
import { isRegisterPrePhotoPendingQueueReady } from '@/lib/register-pre-photo-pending-queue'
import { verifyRegisterPrePhotoForStoredProduct } from '@/lib/register-pre-photo-verify'

export const REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE: Prisma.ProductWhereInput = {
  OR: [
    { registrationStatus: null },
    { registrationStatus: '' },
    { registrationStatus: 'pending' },
  ],
}

/** KPI·목록 where — pending status + denormalized live-queue flag */
export const REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE: Prisma.ProductWhereInput = {
  AND: [REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE, { registerPrePhotoQueueReady: true }],
}

export type RegisterPrePhotoPendingQueueProductRow = {
  listingKind: string | null
  productType: string | null
  sportsThemeTag: string[] | null
  schedule: string | null
  destination?: string | null
  title?: string | null
  countryKey?: string | null
}

export function productRowIsLiveRegisterPendingQueue(
  p: RegisterPrePhotoPendingQueueProductRow,
): boolean {
  // REGRESSION-FREEZE[pending-pexels-pick-verify-parity]: 큐도 title·dest 포함 공통 검증 — manifest
  // REGRESSION-FREEZE[register-pre-photo-product-country-schedule]: countryKey 교차 — manifest
  const live = verifyRegisterPrePhotoForStoredProduct(p)
  return isRegisterPrePhotoPendingQueueReady(live)
}

/** 대시보드 KPI · 등록대기 목록과 같은 큐 길이 (schedule 전수 스캔 없음) */
export async function countLiveRegisterPrePhotoPendingQueue(): Promise<number> {
  return withPrismaRetry('admin-pending-queue-count', () =>
    prisma.product.count({ where: REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE }),
  )
}
