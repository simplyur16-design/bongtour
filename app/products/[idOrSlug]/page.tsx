import type { Metadata } from 'next'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { connection } from 'next/server'
import { notFound } from 'next/navigation'
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
import { publicProductPath } from '@/lib/product-public-path'
import { loadProductForMetadataCached } from '@/lib/product-detail-page-cache'
import { resolveProductPageAccess } from '@/lib/resolve-product-page-access'
import { runWithQueryLogScope } from '@/lib/prisma-query-log'
import { ProductDetailPageContent } from '@/app/products/[idOrSlug]/product-detail-page-content'
import { ProductDetailHeroChunk } from '@/app/products/[idOrSlug]/product-detail-hero-chunk'
import ProductDetailTransitionShell from '@/components/products/ProductDetailTransitionShell'
import ProductDetailHeroSlot from '@/components/products/ProductDetailHeroSlot'

// `headers()` UA 분기로 라우트가 dynamic — `revalidate` ISR은 적용되지 않음.
// 상품 데이터는 `loadProductDetailRowCached` unstable_cache(v2, 3600s)가 담당.

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

  const userAgent = (await headers()).get('user-agent')

  return (
    <ProductDetailTransitionShell idOrSlug={idOrSlug} userAgent={userAgent}>
      <ProductDetailHeroSlot>
        <Suspense fallback={null}>
          <ProductDetailHeroChunk idOrSlug={idOrSlug} />
        </Suspense>
      </ProductDetailHeroSlot>
      <Suspense fallback={null}>
        <ProductDetailPageContent idOrSlug={idOrSlug} />
      </Suspense>
    </ProductDetailTransitionShell>
  )
}
