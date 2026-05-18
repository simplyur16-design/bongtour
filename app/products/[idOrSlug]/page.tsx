import type { Metadata } from 'next'
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
import { requireAdmin } from '@/lib/require-admin'
import { PRODUCT_DETAIL_PAGE_INCLUDE } from '@/lib/product-detail-page-include'
import { ProductDetailView } from '@/app/products/[idOrSlug]/product-detail-view'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { publicProductPath } from '@/lib/product-public-path'
import { resolveProductByPathSegment } from '@/lib/resolve-product-by-path-segment'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ idOrSlug: string }> }

const PRODUCT_METADATA_SELECT = {
  id: true,
  slug: true,
  title: true,
  primaryDestination: true,
  destination: true,
  bgImageUrl: true,
  schedule: true,
  registrationStatus: true,
  itineraries: { orderBy: { day: 'asc' as const }, select: { day: true, description: true } },
} as const

async function loadProductForMetadata(productId: string) {
  let p = await prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    select: PRODUCT_METADATA_SELECT,
  })
  if (!p) {
    const admin = await requireAdmin()
    if (admin) {
      p = await prisma.product.findFirst({
        where: { id: productId },
        select: PRODUCT_METADATA_SELECT,
      })
    }
  }
  return p
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { idOrSlug } = await params
  const resolved = await resolveProductByPathSegment(idOrSlug, { allowAdminDraft: true })
  if (resolved.kind === 'redirect') {
    return { title: '상품' }
  }
  if (resolved.kind === 'not_found') {
    return { title: '상품' }
  }

  const p = await loadProductForMetadata(resolved.productId)
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

  const admin = await requireAdmin()
  const resolved = await resolveProductByPathSegment(idOrSlug, { allowAdminDraft: Boolean(admin) })

  if (resolved.kind === 'redirect') {
    permanentRedirect(`/products/${resolved.slug}`)
  }
  if (resolved.kind === 'not_found') {
    notFound()
  }

  const productId = resolved.productId

  let travelProduct = await prisma.product.findFirst({
    where: {
      id: productId,
      registrationStatus: 'registered',
      AND: [publicProductWhereClause()],
    },
    include: PRODUCT_DETAIL_PAGE_INCLUDE,
  })
  if (!travelProduct && admin) {
    travelProduct = await prisma.product.findFirst({
      where: { id: productId },
      include: PRODUCT_DETAIL_PAGE_INCLUDE,
    })
  }

  if (!travelProduct) {
    notFound()
  }

  const fitMaster =
    travelProduct.productType === 'airtel'
      ? await prisma.fitItineraryMaster.findUnique({
          where: { productId: travelProduct.id },
          include: {
            days: {
              orderBy: { dayNumber: 'asc' },
              include: {
                activities: {
                  orderBy: { order: 'asc' },
                  include: { validation: true },
                },
              },
            },
          },
        })
      : null

  return <ProductDetailView travelProduct={travelProduct} fitMaster={fitMaster} />
}
