/**
 * 상품 등록·이미지 파이프라인에서 여정지도 자동 생성.
 * confirm을 막지 않도록 백그라운드 스케줄도 제공한다.
 */

import type { PrismaClient } from '@prisma/client'
import { generateAndPersistItineraryRouteMap } from '@/lib/itinerary-route-map-generate'
import type { GenerateItineraryRouteMapResult } from '@/lib/itinerary-route-map-generate'

export async function ensureItineraryRouteMapForProduct(
  prisma: PrismaClient,
  productId: string,
  options?: { force?: boolean },
): Promise<GenerateItineraryRouteMapResult> {
  return generateAndPersistItineraryRouteMap(prisma, productId, {
    force: options?.force === true,
  })
}

/** confirm/저장 경로용 — 실패해도 호출부를 깨지 않음 */
export function scheduleItineraryRouteMapGeneration(
  productId: string,
  options?: { force?: boolean },
): void {
  const id = String(productId ?? '').trim()
  if (!id) return
  void (async () => {
    try {
      const { prisma } = await import('@/lib/prisma')
      const result = await ensureItineraryRouteMapForProduct(prisma, id, options)
      if (!result.ok) {
        console.warn('[itinerary-route-map] schedule skip/fail', id, result.error)
        return
      }
      if (result.skipped) {
        console.info('[itinerary-route-map] schedule skipped (exists)', id)
        return
      }
      console.info('[itinerary-route-map] schedule ok', id, result.meta.url)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[itinerary-route-map] schedule exception', id, msg)
    }
  })()
}
