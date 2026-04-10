import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
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
import { ProductDetailView } from '@/app/products/[id]/product-detail-view'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ id: string }> }

const PRODUCT_METADATA_SELECT = {
  id: true,
  title: true,
  primaryDestination: true,
  destination: true,
  bgImageUrl: true,
  schedule: true,
  registrationStatus: true,
  itineraries: { orderBy: { day: 'asc' as const }, select: { day: true, description: true } },
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  let p = await prisma.product.findFirst({
    where: { id, registrationStatus: 'registered' },
    select: PRODUCT_METADATA_SELECT,
  })
  if (!p) {
    const admin = await requireAdmin()
    if (admin) {
      p = await prisma.product.findFirst({
        where: { id },
        select: PRODUCT_METADATA_SELECT,
      })
    }
  }
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
  const path = `/products/${p.id}`
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
 * Public product detail. Draft rows render only when `requireAdmin()` succeeds.
 * If `/products/[id]` still 404s while logged in, use `/admin/products/[id]/customer-view`.
 */
export default async function ProductDetailPage({ params }: Props) {
  const resolvedParams = await params
  const id = resolvedParams?.id
  if (typeof id !== 'string' || !id.trim()) {
    notFound()
  }
  let travelProduct = await prisma.product.findFirst({
    where: { id, registrationStatus: 'registered' },
    include: PRODUCT_DETAIL_PAGE_INCLUDE,
  })
  if (!travelProduct) {
    const admin = await requireAdmin()
    if (admin) {
      travelProduct = await prisma.product.findFirst({
        where: { id },
        include: PRODUCT_DETAIL_PAGE_INCLUDE,
      })
    }
  }

  if (!travelProduct) {
    notFound()
  }

  return <ProductDetailView travelProduct={travelProduct} />
}
