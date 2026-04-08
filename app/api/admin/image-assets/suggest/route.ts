import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { normalizeDestinationsForLookup } from '@/lib/destination-normalize'
import { extractAttractionKeywordsFromText } from '@/lib/attraction-keywords'

const MAX_CITY = 3
const MAX_ATTRACTION = 3

export type ImageAssetCandidate = {
  imageUrl: string
  source: string
  photographer?: string | null
  sourceUrl?: string | null
  externalId?: string | null
  label: string
}

export type ImageAssetsSuggestResponse =
  | { ok: true; cityCandidates: ImageAssetCandidate[]; attractionCandidates: ImageAssetCandidate[] }
  | { ok: false; error: string }

/**
 * GET /api/admin/image-assets/suggest?productId=...
 * 상품의 destination·title을 이용해 DestinationImageSet·PhotoPool 후보 조회.
 *
 * 원칙: 공급사 원문(Product.destination, title, schedule 등)은 읽기만 하고 절대 저장/수정하지 않는다.
 * 목적지 정규화·관광지 키워드는 이미지 자산 추천용 내부 조회 전용이며, 정규화 결과는 DB에 반영하지 않는다.
 * 총 1~6장 내외 (도시 3 + 관광지 3).
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' } satisfies ImageAssetsSuggestResponse, {
      status: 401,
    })
  }
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')?.trim()
    if (!productId) {
      return NextResponse.json(
        { ok: false, error: 'productId 쿼리 필요' } satisfies ImageAssetsSuggestResponse,
        { status: 400 }
      )
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, destination: true, title: true },
    })
    if (!product) {
      return NextResponse.json(
        { ok: false, error: '상품을 찾을 수 없습니다.' } satisfies ImageAssetsSuggestResponse,
        { status: 404 }
      )
    }

    // 이미지 자산 조회용 내부 정규화. Product.destination 원문은 변경하지 않음.
    const rawDestination = (product.destination ?? '').trim()
    const cityKeys = normalizeDestinationsForLookup(product.destination)
    const lookupKeys = cityKeys.length > 0 ? cityKeys : (rawDestination ? [rawDestination] : [])

    const attractionKeywords = extractAttractionKeywordsFromText(
      [product.title ?? '', rawDestination].filter(Boolean).join(' ')
    )

    const cityCandidates: ImageAssetCandidate[] = []
    const attractionCandidates: ImageAssetCandidate[] = []

    if (lookupKeys.length === 0) {
      return NextResponse.json({
        ok: true,
        cityCandidates: [],
        attractionCandidates: [],
      } satisfies ImageAssetsSuggestResponse)
    }

    // 1) DestinationImageSet: 정규화된 도시 키 순서대로 시도
    for (const cityKey of lookupKeys) {
      if (cityCandidates.length >= MAX_CITY) break
      const dis = await prisma.destinationImageSet.findUnique({
        where: { destinationName: cityKey },
      })
      if (dis?.mainImageUrl) {
        let photographer: string | null = null
        let sourceUrl: string | null = null
        if (dis.mainImageSource) {
          try {
            const meta = JSON.parse(dis.mainImageSource) as Record<string, unknown>
            photographer = typeof meta.photographer === 'string' ? meta.photographer : null
            sourceUrl = typeof meta.originalLink === 'string' ? meta.originalLink : null
          } catch {
            // keep defaults
          }
        }
        cityCandidates.push({
          imageUrl: dis.mainImageUrl,
          source: 'destination-set',
          photographer,
          sourceUrl,
          externalId: dis.id,
          label: `도시 대표 (${cityKey})`,
        })
      }
    }

    // 2) PhotoPool: 정규화된 도시 키에 해당하는 풀 조회. 원문에 등장한 관광지 키워드와 일치하면 관광지 후보로 우선.
    const poolList = await prisma.photoPool.findMany({
      where: { cityName: { in: lookupKeys } },
      orderBy: [{ cityName: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      take: 20,
    })

    // lookupKeys 순서 유지: 먼저 나온 도시의 풀을 우선 사용
    const orderOfCity = new Map(lookupKeys.map((k, i) => [k, i]))
    const poolSorted = [...poolList].sort(
      (a, b) => (orderOfCity.get(a.cityName) ?? 99) - (orderOfCity.get(b.cityName) ?? 99) || a.sortOrder - b.sortOrder
    )

    const seenUrls = new Set<string>()
    for (const row of poolSorted) {
      const imageUrl = row.filePath.startsWith('http') ? row.filePath : (row.filePath.startsWith('/') ? row.filePath : '/' + row.filePath)
      if (seenUrls.has(imageUrl)) continue
      seenUrls.add(imageUrl)

      const isAttractionMatch =
        row.attractionName &&
        attractionKeywords.length > 0 &&
        (attractionKeywords.includes(row.attractionName) ||
          attractionKeywords.some((k) => row.attractionName!.includes(k)))

      const candidate: ImageAssetCandidate = {
        imageUrl,
        source: 'photopool',
        photographer: row.source || null,
        sourceUrl: null,
        externalId: row.id,
        label: row.attractionName ? `관광지: ${row.attractionName}` : `도시 사진 풀 (${row.cityName})`,
      }

      if (row.attractionName && isAttractionMatch && attractionCandidates.length < MAX_ATTRACTION) {
        attractionCandidates.push(candidate)
      } else if (cityCandidates.length < MAX_CITY) {
        cityCandidates.push(candidate)
      } else if (attractionCandidates.length < MAX_ATTRACTION) {
        attractionCandidates.push(candidate)
      }
    }

    return NextResponse.json({
      ok: true,
      cityCandidates: cityCandidates.slice(0, MAX_CITY),
      attractionCandidates: attractionCandidates.slice(0, MAX_ATTRACTION),
    } satisfies ImageAssetsSuggestResponse)
  } catch (e) {
    console.error('[image-assets/suggest]', e)
    return NextResponse.json(
      {
        ok: false,
        error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      } satisfies ImageAssetsSuggestResponse,
      { status: 500 }
    )
  }
}
