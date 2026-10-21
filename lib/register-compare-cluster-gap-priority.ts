/**
 * 비교 클러스터 모자란 공급사 수집 → 등록대기 목록 우선 정렬 플래그.
 * REGRESSION-FREEZE[pending-compare-gap-priority]: stamp + orderBy — manifest
 */

import { prisma } from '@/lib/prisma'

/** Prisma orderBy for admin pending list — gap first, then updatedAt */
export const REGISTER_PRE_PHOTO_PENDING_LIST_ORDER_BY = [
  { registerCompareClusterGapPriority: 'desc' as const },
  { updatedAt: 'desc' as const },
]

export async function markProductCompareClusterGapPriority(productId: string): Promise<void> {
  const id = String(productId || '').trim()
  if (!id) return
  // REGRESSION-FREEZE[pending-compare-gap-priority]: gap ingest stamp — manifest
  await prisma.product.update({
    where: { id },
    data: { registerCompareClusterGapPriority: true },
  })
}
