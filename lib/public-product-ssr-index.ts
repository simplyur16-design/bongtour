/**
 * 목록 페이지(/products, /travel/overseas) 서버 렌더 상품 목록 — JS 없이도 상품명·링크·짧은 설명이 HTML 에 있도록.
 * REGRESSION-FREEZE[seo-list-ssr-index]: 공개 상품만(registered + publicProductWhereClause), 국외연수 제외 — manifest
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSkipDbAtBuild } from '@/lib/build-time-db'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { publicProductPath } from '@/lib/product-public-path'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'
import { AIR_HOTEL_LISTING_KIND, AIR_HOTEL_PRODUCT_TYPE } from '@/lib/air-hotel-product-ssot'
import { resolvePublicProductDisplayFullTitle } from '@/lib/supplier-product-title-display'
import {
  applyLocalDepartureDisplayPrefix,
  resolveDisplayLocalDepartureTags,
} from '@/lib/local-departure-display-prefix'

export type PublicProductSsrIndexItem = {
  id: string
  href: string
  title: string
  summary: string
}

export type PublicProductSsrIndexScope = 'all' | 'overseas_package'

const AIR_HOTEL_PRODUCT_TYPES = [AIR_HOTEL_PRODUCT_TYPE, 'airtel', 'air-tel', 'air_hotel']

export function publicProductSsrIndexWhere(
  scope: PublicProductSsrIndexScope,
  now: Date = new Date(),
): Prisma.ProductWhereInput {
  const and: Prisma.ProductWhereInput[] = [
    publicProductWhereClause(now),
    { OR: [{ listingKind: null }, { NOT: { listingKind: OVERSEAS_TRAINING_LISTING_KIND } }] },
  ]
  if (scope === 'overseas_package') {
    // 해외 허브 = 패키지만 (자유여행 항공+호텔 제외) — products-browse-db-where 와 같은 기준
    and.push({
      NOT: {
        OR: [{ listingKind: AIR_HOTEL_LISTING_KIND }, { productType: { in: AIR_HOTEL_PRODUCT_TYPES } }],
      },
    })
  }
  return { registrationStatus: 'registered', AND: and }
}

type Row = {
  id: string
  slug: string | null
  title: string
  primaryDestination: string | null
  destination: string | null
  duration: string | null
  localDepartureTag: string[]
  departureAirportLabel: string | null
}

export function toPublicProductSsrIndexItem(r: Row): PublicProductSsrIndexItem {
  // REGRESSION-FREEZE[local-departure-display-prefix]: 공개 상품명은 지방출발 표시 함수 경유 — manifest
  const title = applyLocalDepartureDisplayPrefix(
    resolvePublicProductDisplayFullTitle(r.title),
    resolveDisplayLocalDepartureTags(r),
  )
  const dest = (r.primaryDestination ?? r.destination ?? '').trim()
  const dur = (r.duration ?? '').trim()
  const parts = [dest, dur].filter(Boolean)
  const summary = parts.length
    ? `${parts.join(' · ')} — 일정·출발 정보와 여행 안내를 확인하세요.`
    : '일정·출발 정보와 여행 안내를 확인하세요.'
  return { id: r.id, href: publicProductPath(r), title: (title ?? '').trim() || '여행 상품', summary }
}

export async function listPublicProductsForSsrIndex(args: {
  scope: PublicProductSsrIndexScope
  limit?: number
}): Promise<PublicProductSsrIndexItem[]> {
  if (shouldSkipDbAtBuild()) return []
  try {
    const rows = await prisma.product.findMany({
      where: publicProductSsrIndexWhere(args.scope),
      select: {
        id: true,
        slug: true,
        title: true,
        primaryDestination: true,
        destination: true,
        duration: true,
        localDepartureTag: true,
        departureAirportLabel: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: Math.min(Math.max(args.limit ?? 48, 1), 120),
    })
    return rows.map(toPublicProductSsrIndexItem)
  } catch (e) {
    console.error('[public-product-ssr-index] DB unavailable — empty list', e)
    return []
  }
}
