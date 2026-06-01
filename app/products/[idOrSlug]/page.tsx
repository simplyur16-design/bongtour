import type { Metadata } from 'next'
import { connection } from 'next/server'
import { notFound, permanentRedirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { getFinalCoverImageUrl } from '@/lib/final-image-selection'
import { tryCaptionFromPublicImageUrl } from '@/lib/image-asset-public-caption'
import {
  absoluteUrl,
  buildPublicProductDescription,
  DEFAULT_OG_IMAGE_PATH,
  SITE_NAME,
  toAbsoluteImageUrl,
} from '@/lib/site-metadata'
import { ProductDetailView } from '@/app/products/[idOrSlug]/product-detail-view'
import { publicProductPath } from '@/lib/product-public-path'
import {
  loadProductDetailRowCached,
  loadProductForMetadataCached,
  consumeProductDetailUnstableCacheMiss,
} from '@/lib/product-detail-page-cache'
import { resolveProductPageAccess } from '@/lib/resolve-product-page-access'
import { runWithQueryLogScope } from '@/lib/prisma-query-log'

/** 공개 등록 상품 — 5분 ISR. draft 미리보기는 요청 시 `connection()`으로 동적 렌더 */
export const revalidate = 300

const FIT_ITINERARY_MASTER_DETAIL_INCLUDE = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      activities: {
        orderBy: { order: 'asc' as const },
        include: { validation: true },
      },
    },
  },
} as const

function loadFitItineraryMasterForProduct(productId: string, productType: string | null | undefined) {
  if (productType !== 'airtel') return Promise.resolve(null)
  return prisma.fitItineraryMaster.findUnique({
    where: { productId },
    include: FIT_ITINERARY_MASTER_DETAIL_INCLUDE,
  })
}

type Props = {
  params: Promise<{ idOrSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idOrSlug } = await params
  return runWithQueryLogScope(`/products/${idOrSlug} [metadata]`, async () => {
    return generateMetadataInner(idOrSlug)
  })
}

async function generateMetadataInner(idOrSlug: string): Promise<Metadata> {
  const { resolved, allowAdminDraft } = await resolveProductPageAccess(idOrSlug)
  if (allowAdminDraft) await connection()
  if (resolved.kind === 'redirect') {
    return { title: '상품' }
  }
  if (resolved.kind === 'not_found') {
    return { title: '상품' }
  }

  const p = await loadProductForMetadataCached(resolved.productId)
  if (!p) {
    return { title: '상품' }
  }

  const scheduleRows = getScheduleFromProduct(p)
  const coverUrl = getFinalCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays: scheduleRows })
  const ogImage = toAbsoluteImageUrl(coverUrl) ?? absoluteUrl(DEFAULT_OG_IMAGE_PATH)
  const desc = buildPublicProductDescription({
    title: p.title,
    primaryDestination: p.primaryDestination,
    destination: p.destination,
  })
  const dest = (p.primaryDestination ?? p.destination ?? '').trim()
  const path = publicProductPath(p)
  const titleSeg = `${p.title}${dest ? ` · ${dest}` : ''} · 여행 상품 안내`
  const scheduleImageCaption = scheduleRows.find((d) => d.imageDisplayName?.trim())?.imageDisplayName?.trim()
  const captionFromImageAsset = await tryCaptionFromPublicImageUrl(coverUrl)
  const ogCaption = scheduleImageCaption || captionFromImageAsset
  const ogImageAlt = ogCaption ? `${p.title} — ${ogCaption}` : p.title
  const isDraft = p.registrationStatus !== 'registered'
  return {
    title: isDraft ? `${titleSeg} (관리자 미리보기)` : titleSeg,
    description: desc,
    alternates: { canonical: path },
    ...(isDraft ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title: `${p.title} | ${SITE_NAME}`,
      description: desc,
      url: path,
      type: 'website',
      images: [{ url: ogImage, alt: ogImageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${p.title} | ${SITE_NAME}`,
      description: desc,
      images: [ogImage],
    },
  }
}

/**
 * Public product detail. slug 우선 URL; cuid 접근 시 slug가 있으면 permanent redirect.
 * Draft rows render only when `requireAdmin()` succeeds.
 */
export default async function ProductDetailPage({ params }: Props) {
  const { idOrSlug } = await params
  if (typeof idOrSlug !== 'string' || !idOrSlug.trim()) {
    notFound()
  }

  return runWithQueryLogScope(`/products/${idOrSlug}`, () => productDetailPageInner(idOrSlug))
}

async function productDetailPageInner(idOrSlug: string) {
  const perfPage = process.env.BONGTOUR_PERF_LOG === '1' // PERF-LOG: 측정 후 제거
  const t0 = perfPage ? Date.now() : 0 // PERF-LOG: 측정 후 제거

  const tResolved = perfPage ? Date.now() : 0 // PERF-LOG: 측정 후 제거
  const { resolved, allowAdminDraft } = await resolveProductPageAccess(idOrSlug)
  const resolveMs = perfPage ? Date.now() - tResolved : 0 // PERF-LOG: 측정 후 제거

  if (allowAdminDraft) await connection()

  if (resolved.kind === 'redirect') {
    permanentRedirect(`/products/${resolved.slug}`)
  }
  if (resolved.kind === 'not_found') {
    notFound()
  }

  const productId = resolved.productId

  const tProduct = perfPage ? Date.now() : 0 // PERF-LOG: 측정 후 제거
  const [travelProduct, fitMaster] = await Promise.all([
    loadProductDetailRowCached(productId, allowAdminDraft),
    loadFitItineraryMasterForProduct(productId, resolved.productType),
  ])
  const productMs = perfPage ? Date.now() - tProduct : 0 // PERF-LOG: 측정 후 제거

  if (perfPage) {
    const cacheMiss = consumeProductDetailUnstableCacheMiss()
    const cacheLabel =
      allowAdminDraft ? 'draft-fresh' : cacheMiss === true ? 'miss' : cacheMiss === false ? 'hit' : 'unknown'
    console.log(
      `[product-detail-perf] slug=${idOrSlug} resolve=${resolveMs}ms product+fit=${productMs}ms total=${Date.now() - t0}ms cache=${cacheLabel}`,
    ) // PERF-LOG: 측정 후 제거
  }

  if (!travelProduct) {
    notFound()
  }

  return (
    <ProductDetailView
      travelProduct={travelProduct}
      fitMaster={fitMaster}
    />
  )
}
