import { applyLocalDepartureDisplayPrefix, resolveDisplayLocalDepartureTags } from '@/lib/local-departure-display-prefix'
import { prisma } from '@/lib/prisma'
import { getSiteOrigin } from '@/lib/site-metadata'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { publicProductPath } from '@/lib/product-public-path'
import { shouldSkipSitemapDbAtBuild } from '@/lib/sitemap-build'
import {
  OVERSEAS_TRAINING_LISTING_KIND,
  trainingProgramPublicPath,
} from '@/lib/overseas-training-program-query'
import { createLastGoodCache } from '@/lib/seo/last-good-cache'
import {
  buildImageSitemapXml,
  IMAGE_SITEMAP_CONTENT_TYPE,
  type ImageSitemapEntry,
} from '@/lib/seo/image-sitemap'

/**
 * 이미지 사이트맵 — 요청 시 DB(공개 상품만). 삭제·비공개 상품은 조회 조건에서 빠진다.
 * REGRESSION-FREEZE[seo-image-sitemap-valid-xml]: 국외연수는 `/business/programs/*` 정식 주소, XML 제어문자 제거 — manifest
 */
export const dynamic = 'force-dynamic'

function pickImageCaption(p: {
  title: string
  bgImageRehostSearchLabel: string | null
  bgImagePlaceName: string | null
  publicImageHeroSeoLine: string | null
}): string {
  const chain = [
    p.bgImageRehostSearchLabel,
    p.bgImagePlaceName,
    p.publicImageHeroSeoLine,
    p.title,
  ]
  for (const raw of chain) {
    const t = typeof raw === 'string' ? raw.trim() : ''
    if (t) return t
  }
  return (p.title ?? '').trim() || '상품'
}

function xmlResponse(body: string, method: 'GET' | 'HEAD' = 'GET'): Response {
  return new Response(method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': IMAGE_SITEMAP_CONTENT_TYPE,
      'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600',
    },
  })
}

/**
 * 신선 5분은 DB 없이 응답, 재생성은 8초 안에서만, 실패·초과는 마지막 정상본(없으면 빈 urlset)을 200 으로.
 * REGRESSION-FREEZE[seo-image-sitemap-last-good]: 5xx·빈 본문 대신 마지막 정상본 — manifest
 */
const imageSitemapCache = createLastGoodCache<string>({ freshMs: 300_000, timeoutMs: 8_000 })

async function buildBody(origin: string): Promise<string> {
  let products: {
    id: string
    slug: string | null
    title: string
    listingKind: string | null
    localDepartureTag: string[]
    departureAirportLabel: string | null
    bgImageUrl: string | null
    bgImageRehostSearchLabel: string | null
    bgImagePlaceName: string | null
    publicImageHeroSeoLine: string | null
  }[] = []
  try {
    products = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        bgImageUrl: { not: null },
        AND: [publicProductWhereClause()],
      },
      select: {
        id: true,
        slug: true,
        title: true,
        listingKind: true,
        localDepartureTag: true,
        departureAirportLabel: true,
        bgImageUrl: true,
        bgImageRehostSearchLabel: true,
        bgImagePlaceName: true,
        publicImageHeroSeoLine: true,
      },
      take: 5000,
      orderBy: { updatedAt: 'desc' },
    })
  } catch (e) {
    console.error('[sitemap-images] DB unavailable', e)
    throw e
  }

  const entries: ImageSitemapEntry[] = []
  for (const p of products) {
    const imgUrl = (p.bgImageUrl ?? '').trim()
    if (!imgUrl) continue
    // 국외연수 8개는 상품 상세가 아니라 `/business/programs/<slug>` 가 정식 주소(상세 /products/* 는 301)
    const path =
      p.listingKind === OVERSEAS_TRAINING_LISTING_KIND ? trainingProgramPublicPath(p) : publicProductPath(p)
    // REGRESSION-FREEZE[local-departure-display-prefix]: 공개 상품명은 지방출발 표시 함수 경유 — manifest
    const displayTitle = applyLocalDepartureDisplayPrefix(p.title, resolveDisplayLocalDepartureTags(p))
    const title = (displayTitle ?? '').trim() || '상품'
    entries.push({
      loc: `${origin}${path}`,
      imageUrl: imgUrl,
      caption: pickImageCaption({ ...p, title: displayTitle }),
      title,
    })
  }
  return buildImageSitemapXml(entries, origin)
}

export async function GET() {
  const origin = getSiteOrigin()
  if (shouldSkipSitemapDbAtBuild()) return xmlResponse(buildImageSitemapXml([], origin))
  const { value } = await imageSitemapCache.get(
    () => buildBody(origin),
    () => buildImageSitemapXml([], origin),
  )
  return xmlResponse(value)
}

export async function HEAD() {
  return xmlResponse('', 'HEAD')
}
