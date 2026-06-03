import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  editorialRowToBriefingPayload,
  fetchPublishedOverseasEditorials,
  prioritizeEditorialsByRegionAndCountry,
} from '@/lib/overseas-editorial-prioritize'
import { resolveOverseasGeoFilterBannerSafe } from '@/lib/overseas-destination-browse'
import { prefetchOverseasHubBrowse } from '@/lib/products-browse-server-prefetch'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
  region: string | null
  country: string | null
}

/** 해외 허브 상품 목록 — browse·브리핑 실패 시 인라인 안내(전체 라우트 500 방지) */
export default async function OverseasBrowseSlot({ searchParams, region, country }: Props) {
  try {
    const [overseasGeoFilterBanner, editorialAll, hubBrowse] = await Promise.all([
      resolveOverseasGeoFilterBannerSafe(searchParams),
      fetchPublishedOverseasEditorials().catch(
        (): Awaited<ReturnType<typeof fetchPublishedOverseasEditorials>> => [],
      ),
      prefetchOverseasHubBrowse(searchParams),
    ])

    let overseasEditorialBriefing: OverseasEditorialBriefingPayload | null = null
    try {
      const prioritized = prioritizeEditorialsByRegionAndCountry(editorialAll, region, country)
      overseasEditorialBriefing = editorialRowToBriefingPayload(prioritized[0], 220)
    } catch {
      // 브리핑만 생략
    }

    return (
      <ProductsBrowseClient
        basePath="/travel/overseas"
        defaultScope="overseas"
        pageTitle="해외여행 상품"
        hidePageHeading
        overseasEditorialBriefing={overseasEditorialBriefing}
        overseasGeoFilterBanner={overseasGeoFilterBanner}
        initialBrowse={hubBrowse?.payload ?? null}
        initialBrowseQueryKey={hubBrowse?.queryKey ?? null}
      />
    )
  } catch (e) {
    console.error('[OverseasBrowseSlot] render failed', e)
    return <OverseasBrowseSlotError />
  }
}

function OverseasBrowseSlotError() {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-base font-semibold text-slate-900">상품 목록을 불러오지 못했습니다</p>
      <p className="mt-2 text-sm text-slate-600">
        일시적인 서버 부하일 수 있습니다. 잠시 후 새로고침하거나 상담으로 문의해 주세요.
      </p>
      <a
        href="/inquiry?type=travel"
        className="mt-6 inline-flex rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
      >
        상담 문의
      </a>
    </div>
  )
}
