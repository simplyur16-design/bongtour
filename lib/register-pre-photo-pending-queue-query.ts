/**
 * 등록대기 큐 조회 — DB pending이 아니라 live verify.ok.
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 대시보드=등록대기 화면 — manifest
 */
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { resolveRegisterAdminLane } from '@/lib/register-admin-lane'
import { isRegisterPrePhotoPendingQueueReady } from '@/lib/register-pre-photo-pending-queue'
import {
  scheduleRowsForPrePhotoVerify,
  verifyRegisterPrePhoto,
} from '@/lib/register-pre-photo-verify'

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
}

export function productRowIsLiveRegisterPendingQueue(
  p: RegisterPrePhotoPendingQueueProductRow,
): boolean {
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
    rows: scheduleRowsForPrePhotoVerify(p.schedule),
  })
  return isRegisterPrePhotoPendingQueueReady(live)
}

/** 대시보드 KPI · 등록대기 목록과 같은 큐 길이 */
export async function countLiveRegisterPrePhotoPendingQueue(): Promise<number> {
  const list = await prisma.product.findMany({
    where: REGISTER_PRE_PHOTO_PENDING_DB_STATUS_WHERE,
    select: {
      listingKind: true,
      productType: true,
      sportsThemeTag: true,
      schedule: true,
    },
  })
  return list.filter(productRowIsLiveRegisterPendingQueue).length
}
