/**
 * 노랑풍선(ybtour) 전용 — 재스크랩으로 반영된 ProductDeparture 를 기준으로
 * 동일 출발일 ProductPrice 를 맞춘다 (날짜당 1행 모델).
 *
 * 삭제: `ProductPrice` 중 해당 productId 이고 출발일이 입력에 포함된 날짜.
 * 생성: 해당 날짜 중 `adultPrice > 0` 인 ProductDeparture 행만 → ProductPrice 행.
 */
import type { PrismaClient } from '@prisma/client'
import { normalizeDepartureDate } from '@/lib/upsert-product-departures-ybtour'

type MinimalDepartureInput = { departureDate: string | Date }

export type YbtourProductPriceSyncResult = {
  /** createMany 성공 건수 */
  syncedCount: number
  /** 삭제 대상이 된 출발일(UTC) 개수 */
  datesCleared: number
  /** 삭제 후 재생성 스킵(성인가 없음)된 날짜 수 */
  skippedNoAdultPrice: number
  /** DB/검증 오류 시 메시지 */
  error: string | null
}

export async function syncYbtourProductPricesFromDepartureInputsDetailed(
  prisma: PrismaClient,
  productId: string,
  inputs: MinimalDepartureInput[]
): Promise<YbtourProductPriceSyncResult> {
  const empty: YbtourProductPriceSyncResult = {
    syncedCount: 0,
    datesCleared: 0,
    skippedNoAdultPrice: 0,
    error: null,
  }
  const dates: Date[] = []
  for (const d of inputs) {
    const dep = normalizeDepartureDate(d.departureDate)
    if (dep) dates.push(dep)
  }
  if (dates.length === 0) return empty

  const uniqueDates = [...new Map(dates.map((d) => [d.getTime(), d])).values()]

  try {
    const deps = await prisma.productDeparture.findMany({
      where: { productId, departureDate: { in: uniqueDates } },
      select: {
        departureDate: true,
        adultPrice: true,
        childBedPrice: true,
        childNoBedPrice: true,
        infantPrice: true,
      },
    })

    const del = await prisma.productPrice.deleteMany({
      where: { productId, date: { in: uniqueDates } },
    })

    const rows = deps
      .filter((r) => r.adultPrice != null && r.adultPrice > 0)
      .map((r) => ({
        productId,
        date: r.departureDate,
        adult: r.adultPrice!,
        childBed: r.childBedPrice ?? 0,
        childNoBed: r.childNoBedPrice ?? 0,
        infant: r.infantPrice ?? 0,
      }))

    const skippedNoAdultPrice = deps.length - rows.length

    if (rows.length === 0) {
      return {
        syncedCount: 0,
        datesCleared: del.count,
        skippedNoAdultPrice,
        error: null,
      }
    }

    const created = await prisma.productPrice.createMany({ data: rows })
    return {
      syncedCount: created.count,
      datesCleared: del.count,
      skippedNoAdultPrice,
      error: null,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { syncedCount: 0, datesCleared: 0, skippedNoAdultPrice: 0, error: msg.slice(0, 400) }
  }
}

/** 호출부 호환: 성공 건수만 반환. 실패는 `syncYbtourProductPricesFromDepartureInputsDetailed` + `.error` 로 확인. */
export async function syncYbtourProductPricesFromDepartureInputs(
  prisma: PrismaClient,
  productId: string,
  inputs: MinimalDepartureInput[]
): Promise<number> {
  const r = await syncYbtourProductPricesFromDepartureInputsDetailed(prisma, productId, inputs)
  if (r.error) {
    console.error('[ybtour-sync-product-prices]', { productId, error: r.error })
  }
  return r.syncedCount
}
