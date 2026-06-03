import OverseasHero from '@/app/components/travel/overseas/OverseasHero'
import { getCachedOverseasHubSeasonDestinationHeroSlides } from '@/lib/overseas-hub-season-destination-hero'

const LOCAL_DEPARTURE_REGIONS = ['busan_dep', 'cheongju_dep', 'daegu_dep'] as const

type Props = {
  selectedCountrySlug: string | null
  selectedRegionSlug: string | null
}

/** 해외 허브 히어로 — 실패 시 빈 슬라이드로 폴백(페이지 전체 RSC 오류 방지) */
export default async function OverseasHeroSlot({ selectedCountrySlug, selectedRegionSlug }: Props) {
  let seasonDestinationHeroSlides: Awaited<ReturnType<typeof getCachedOverseasHubSeasonDestinationHeroSlides>> = []
  try {
    seasonDestinationHeroSlides = await getCachedOverseasHubSeasonDestinationHeroSlides()
  } catch (e) {
    console.error('[OverseasHeroSlot] season hero slides failed', e)
  }

  return (
    <OverseasHero
      selectedCountrySlug={selectedCountrySlug}
      selectedRegionSlug={selectedRegionSlug}
      seasonDestinationHeroSlides={seasonDestinationHeroSlides}
    />
  )
}

export function overseasSelectedRegionSlug(region: string | null): string | null {
  return region && (LOCAL_DEPARTURE_REGIONS as readonly string[]).includes(region) ? region : null
}
