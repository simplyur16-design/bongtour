import OverseasHero from '@/app/components/travel/overseas/OverseasHero'
import { getCachedOverseasHubSeasonDestinationHeroSlides } from '@/lib/overseas-hub-season-destination-hero'
import { getCurrentCycle } from '@/lib/season-curation'

const LOCAL_DEPARTURE_REGIONS = ['busan_dep', 'cheongju_dep', 'daegu_dep'] as const

type Props = {
  selectedCountrySlug: string | null
  selectedRegionSlug: string | null
  initialSearchParamsString?: string
}

/** 해외 허브 히어로 — 실패 시 빈 슬라이드로 폴백(페이지 전체 RSC 오류 방지) */
export default async function OverseasHeroSlot({
  selectedCountrySlug,
  selectedRegionSlug,
  initialSearchParamsString = '',
}: Props) {
  let seasonDestinationHeroSlides: Awaited<ReturnType<typeof getCachedOverseasHubSeasonDestinationHeroSlides>> = []
  try {
    const cycle = await getCurrentCycle(new Date())
    seasonDestinationHeroSlides = await getCachedOverseasHubSeasonDestinationHeroSlides(cycle)
  } catch (e) {
    console.error('[OverseasHeroSlot] season hero slides failed', e)
  }

  return (
    <OverseasHero
      selectedCountrySlug={selectedCountrySlug}
      selectedRegionSlug={selectedRegionSlug}
      seasonDestinationHeroSlides={seasonDestinationHeroSlides}
      initialSearchParamsString={initialSearchParamsString}
    />
  )
}

export function overseasSelectedRegionSlug(region: string | null): string | null {
  return region && (LOCAL_DEPARTURE_REGIONS as readonly string[]).includes(region) ? region : null
}
