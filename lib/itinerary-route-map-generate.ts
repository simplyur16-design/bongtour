/**
 * 일정 동선 플랫 지도 — 코드 SVG 렌더 → 스토리지 → Product.rawMeta 저장.
 */

import type { PrismaClient } from '@prisma/client'
import { convertToWebp } from '@/lib/image-to-webp'
import { resolveItineraryRouteMapCountry } from '@/lib/itinerary-route-map-country'
import {
  extractItineraryRouteMapHubs,
  parseScheduleJsonForRouteMap,
} from '@/lib/itinerary-route-map-hubs'
import { renderItineraryRouteMapPng } from '@/lib/itinerary-route-map-render-svg'
import {
  buildItineraryRouteMapMeta,
  getItineraryRouteMapFromRawMeta,
  mergeItineraryRouteMapIntoRawMeta,
} from '@/lib/itinerary-route-map-raw-meta'
import {
  ITINERARY_ROUTE_MAP_PROMPT_VERSION,
  type ItineraryRouteMapMeta,
} from '@/lib/itinerary-route-map-types'
import {
  buildItineraryRouteMapObjectKey,
  isObjectStorageConfigured,
  uploadStorageObject,
} from '@/lib/object-storage'
import { rebuildProductPublicDetailPayload } from '@/lib/product-public-detail/persist-payload'

export type GenerateItineraryRouteMapResult =
  | { ok: true; meta: ItineraryRouteMapMeta; skipped?: boolean; promptUsed: string }
  | { ok: false; error: string; hubsFound?: number }

export async function generateAndPersistItineraryRouteMap(
  prisma: PrismaClient,
  productId: string,
  options?: { force?: boolean; minHubs?: number },
): Promise<GenerateItineraryRouteMapResult> {
  const force = options?.force === true
  const minHubs = options?.minHubs ?? 2

  if (!isObjectStorageConfigured()) {
    return {
      ok: false,
      error:
        'Object Storage가 설정되지 않았습니다. SUPABASE_URL/NCLOUD 스토리지 환경변수를 확인하세요.',
    }
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      country: true,
      destination: true,
      primaryDestination: true,
      title: true,
      schedule: true,
      rawMeta: true,
    },
  })
  if (!product) return { ok: false, error: '상품을 찾을 수 없습니다.' }

  const existing = getItineraryRouteMapFromRawMeta(product.rawMeta)
  if (existing?.url && !force && existing.promptVersion === ITINERARY_ROUTE_MAP_PROMPT_VERSION) {
    return {
      ok: true,
      meta: existing,
      skipped: true,
      promptUsed: '',
    }
  }

  const schedule = parseScheduleJsonForRouteMap(product.schedule)
  if (schedule.length === 0) {
    return { ok: false, error: '일정(schedule) 데이터가 없습니다.', hubsFound: 0 }
  }

  const { hubs, legs } = extractItineraryRouteMapHubs(schedule)
  if (hubs.length < minHubs) {
    return {
      ok: false,
      error: `방문 거점이 ${hubs.length}개뿐입니다. 최소 ${minHubs}개 도시가 필요합니다.`,
      hubsFound: hubs.length,
    }
  }

  const { countryKo, countryEn } = resolveItineraryRouteMapCountry({
    country: product.country,
    destination: product.destination,
    primaryDestination: product.primaryDestination,
    title: product.title,
  })

  const png = await renderItineraryRouteMapPng({ hubs, legs, countryEn })
  const webp = await convertToWebp(png, { maxWidth: 1600, quality: 88 })
  const objectKey = buildItineraryRouteMapObjectKey(product.id)
  const { publicUrl } = await uploadStorageObject({
    objectKey,
    body: webp.buffer,
    contentType: 'image/webp',
  })

  const meta = buildItineraryRouteMapMeta({
    url: publicUrl,
    countryKo,
    countryEn,
    hubs,
    legs,
  })
  const nextRawMeta = mergeItineraryRouteMapIntoRawMeta(product.rawMeta, meta)
  await prisma.product.update({
    where: { id: product.id },
    data: { rawMeta: nextRawMeta },
  })

  try {
    await rebuildProductPublicDetailPayload(product.id)
  } catch (e) {
    console.warn(
      '[itinerary-route-map] public detail rebuild skipped:',
      e instanceof Error ? e.message : e,
    )
  }

  return { ok: true, meta, promptUsed: 'svg_vector_2d' }
}
