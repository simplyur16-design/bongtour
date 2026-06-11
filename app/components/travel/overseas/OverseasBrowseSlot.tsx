import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  editorialRowToBriefingPayload,
  fetchPublishedOverseasEditorials,
  prioritizeEditorialsByRegionAndCountry,
} from '@/lib/overseas-editorial-prioritize'
import { resolveOverseasGeoFilterBannerSafe } from '@/lib/overseas-destination-browse'
import { computeHubFocusedResultsFromRecord } from '@/lib/hub-focused-results'
import { computeMegaMenuRegionCityGroupIdFromRecord } from '@/lib/overseas-mega-region-city-group'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'
import { normalizeHomeSeasonSlidesForClient } from '@/lib/home-season-pick-shared'
import { getCachedSeasonCurationNextThreeMonthsSlides } from '@/lib/season-curation-content'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
  region: string | null
  country: string | null
}

/** 해외 허브 상품 목록 — browse는 클라이언트 `/api/products/browse`(AirHotel 허브와 동일). RSC browse prefetch는 DB 수 분 점유·502 유발. */
export default async function OverseasBrowseSlot({ searchParams, region, country }: Props) {
  try {
    const [overseasGeoFilterBanner, editorialAll, seasonRaw] = await Promise.all([
      resolveOverseasGeoFilterBannerSafe(searchParams),
      fetchPublishedOverseasEditorials().catch(
        (): Awaited<ReturnType<typeof fetchPublishedOverseasEditorials>> => [],
      ),
      getCachedSeasonCurationNextThreeMonthsSlides().catch(() => [] as Awaited<
        ReturnType<typeof getCachedSeasonCurationNextThreeMonthsSlides>
      >),
    ])
    const overseasSeasonCurationSlides = normalizeHomeSeasonSlidesForClient(seasonRaw)

    let overseasEditorialBriefing: OverseasEditorialBriefingPayload | null = null
    try {
      const prioritized = prioritizeEditorialsByRegionAndCountry(editorialAll, region, country)
      overseasEditorialBriefing = editorialRowToBriefingPayload(prioritized[0], 220)
    } catch {
      // 브리핑만 생략
    }

    const hubBrowseOpts = {
      pathname: '/travel/overseas',
      defaultScope: 'overseas' as const,
      overseasGeoFilterBanner,
    }
    const initialHubFocusedResults = computeHubFocusedResultsFromRecord(searchParams, hubBrowseOpts)
    const initialMegaMenuRegionCityGroupId = computeMegaMenuRegionCityGroupIdFromRecord(
      searchParams,
      hubBrowseOpts,
    )

    return (
      <ProductsBrowseClient
        basePath="/travel/overseas"
        defaultScope="overseas"
        pageTitle="해외여행 상품"
        hidePageHeading
        overseasEditorialBriefing={overseasEditorialBriefing}
        overseasGeoFilterBanner={overseasGeoFilterBanner}
        overseasSeasonCurationSlides={overseasSeasonCurationSlides}
        initialSearchParams={searchParams}
        initialHubFocusedResults={initialHubFocusedResults}
        initialMegaMenuRegionCityGroupId={initialMegaMenuRegionCityGroupId}
        hubGalleryRotationSeed={createHubGalleryRotationSeed()}
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
