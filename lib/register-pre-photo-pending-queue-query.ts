/**
 * 등록대기 큐 조회 — DB pending이 아니라 live verify.ok.
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 대시보드=등록대기 화면 — manifest
 * REGRESSION-FREEZE[admin-pending-list-timeout]: KPI count도 prisma retry — manifest
 * REGRESSION-FREEZE[pending-pexels-pick-verify-parity]: 큐 검증은 title·dest 포함 공통 헬퍼 — manifest
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

export type RegisterPrePhotoPendingQueueProductRow = {
  listingKind: string | null
  productType: string | null
  sportsThemeTag: string[] | null
  schedule: string | null
  destination?: string | null
  title?: string | null
}

export function productRowIsLiveRegisterPendingQueue(
  p: RegisterPrePhotoPendingQueueProductRow,
): boolean {
  // REGRESSION-FREEZE[pending-pexels-pick-verify-parity]: 큐도 title·dest 포함 공통 검증 — manifest
  const live = verifyRegisterPrePhotoForStoredProduct(p)
  return isRegisterPrePhotoPendingQueueReady(live)
}

/** 대시보드 KPI · 등록대기 목록과 같은 큐 길이 */
export async function countLiveRegisterPrePhotoPendingQueue(): Promise<number> {
  const list = await withPrismaRetry('admin-pending-queue-count', () =>
    prisma.product.findMany({
      where: REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
      select: {
        listingKind: true,
        productType: true,
        sportsThemeTag: true,
        schedule: true,
        destination: true,
        title: true,
      },
    }),
  )
  return list.filter(productRowIsLiveRegisterPendingQueue).length
}
