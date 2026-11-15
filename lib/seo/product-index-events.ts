/**
 * 상품 공개 URL 변경 이벤트(등록·수정·삭제) → 사이트맵 무효화 + IndexNow 알림.
 * REGRESSION-FREEZE[seo-indexnow-skip-on-failure]: fire-and-forget, 응답을 막지 않음 — manifest
 * 호출처: 어드민 상품 POST/PATCH/DELETE, 자동 등록(사진 게이트 통과) 잡.
 * 스윕·야간 재빌드처럼 대량으로 도는 경로에서는 부르지 않는다(IndexNow 남용 방지).
 */
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'
import { publicProductPath } from '@/lib/product-public-path'
import {
  OVERSEAS_TRAINING_LISTING_KIND,
  trainingProgramPublicPath,
} from '@/lib/overseas-training-program-query'
import { safeRevalidatePath } from '@/lib/safe-next-cache-revalidate'
import { queueIndexNowUrls } from '@/lib/seo/indexnow'

export const SITEMAP_REVALIDATE_PATHS = ['/sitemap.xml', '/sitemap-images.xml'] as const

export type ProductIndexEventInput = {
  productId: string
  /** 삭제처럼 행이 이미 없을 때 넘긴다 */
  slug?: string | null
  listingKind?: string | null
  /** 행 조회 생략 (삭제 직후) */
  skipLookup?: boolean
}

export function productPublicUrlsForIndex(
  origin: string,
  row: { id: string; slug: string | null; listingKind?: string | null },
): string[] {
  const base = origin.replace(/\/$/, '')
  if ((row.listingKind ?? '') === OVERSEAS_TRAINING_LISTING_KIND) {
    return [`${base}${trainingProgramPublicPath(row)}`]
  }
  const urls = [`${base}${publicProductPath(row)}`]
  return urls
}

export function revalidateSitemapCaches(): void {
  for (const p of SITEMAP_REVALIDATE_PATHS) {
    try {
      safeRevalidatePath(p, 'sitemap-cache')
    } catch {
      /* next 요청 밖 등 — 다음 요청에서 DB 재조회(force-dynamic) */
    }
  }
}

/** never throws, never blocks caller (내부 비동기는 void) */
export function notifyProductPublicUrlChanged(input: ProductIndexEventInput): void {
  try {
    revalidateSitemapCaches()
  } catch {
    /* ignore */
  }
  void (async () => {
    try {
      const id = String(input.productId ?? '').trim()
      if (!id) return
      let row: { id: string; slug: string | null; listingKind: string | null } = {
        id,
        slug: input.slug ?? null,
        listingKind: input.listingKind ?? null,
      }
      if (!input.skipLookup) {
        const found = await prisma.product
          .findUnique({ where: { id }, select: { id: true, slug: true, listingKind: true } })
          .catch(() => null)
        if (found) row = found
      }
      queueIndexNowUrls(productPublicUrlsForIndex(getSiteOrigin(), row))
    } catch (err) {
      console.warn('[product-index-events] SKIP', err instanceof Error ? err.message : String(err))
    }
  })()
}
