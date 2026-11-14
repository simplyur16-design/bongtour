/**
 * 사이트맵 상품 조회 조건 SSOT — 공개 상세와 같은 판정(registered + publicProductWhereClause).
 * 삭제(행 없음)·rejected·pending·pre_photo_blocked·출발 종료 상품은 빠진다.
 * REGRESSION-FREEZE[seo-sitemap-db-public-only]: 사이트맵은 DB 공개 상품만, lastmod=updatedAt — manifest
 */
import type { Prisma } from '@prisma/client'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { OVERSEAS_TRAINING_LISTING_KIND } from '@/lib/overseas-training-program-query'

export const SITEMAP_PRODUCT_TAKE = 5000
export const SITEMAP_TRAINING_TAKE = 500

/** 일반 상품(국외연수 제외) */
export function sitemapPublicProductWhere(now: Date = new Date()): Prisma.ProductWhereInput {
  return {
    registrationStatus: 'registered',
    AND: [
      publicProductWhereClause(now),
      // 연수 프로그램은 /business/programs 주소로 따로 — listingKind NULL 상품은 포함(SQL NOT 의 NULL 제외 방지)
      { OR: [{ listingKind: null }, { NOT: { listingKind: OVERSEAS_TRAINING_LISTING_KIND } }] },
    ],
  }
}

/** 국외연수 프로그램 — `/business/programs/<slug>` 상세와 같은 판정(registered) */
export function sitemapTrainingProgramWhere(): Prisma.ProductWhereInput {
  return {
    registrationStatus: 'registered',
    listingKind: OVERSEAS_TRAINING_LISTING_KIND,
  }
}
