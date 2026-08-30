/**
 * 밤 창 할당량 — 오늘 밤(창 시작 이후) 새로 만든 pending만 센다.
 * 큐에 어제 등록대기가 있어도(예: 12건) 오늘 할당량을 채운 것으로 보지 않는다.
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: 창 동안 할당량까지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-night-leftover-not-quota]: leftover pending ≠ 오늘 할당량 — manifest
 */
import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { CANONICAL_OVERSEAS_SUPPLIER_KEYS } from '@/lib/overseas-supplier-canonical-keys'
import { registerPrePhotoIngestNightWindowStartUtc } from '@/lib/register-pre-photo-ingest-night-window'

export async function countRegisterPrePhotoIngestCreatedTonight(
  windowId: string,
): Promise<Record<string, number>> {
  const start = registerPrePhotoIngestNightWindowStartUtc(windowId)
  const rows = await prisma.product.groupBy({
    by: ['originSource'],
    where: {
      createdAt: { gte: start },
      registrationStatus: 'pending',
      originSource: { in: [...CANONICAL_OVERSEAS_SUPPLIER_KEYS, 'yellowballoon'] },
    },
    _count: { _all: true },
  })
  const out: Record<string, number> = {}
  for (const row of rows) {
    const supplier = normalizeSupplierOrigin(row.originSource)
    if (!supplier) continue
    out[supplier] = (out[supplier] ?? 0) + row._count._all
  }
  return out
}
