import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { computeHubFocusedResultsFromRecord } from '@/lib/hub-focused-results'
import { computeMegaMenuRegionCityGroupIdFromRecord } from '@/lib/overseas-mega-region-city-group'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

const hubBrowseOpts = {
  pathname: '/travel/overseas' as const,
  defaultScope: 'overseas' as const,
  overseasGeoFilterBanner: null,
}

/**
 * 해외 허브 상품 목록 — browse·에디토리얼·시즌은 클라이언트/API만.
 * RSC DB 대기(에디토리얼·시즌·geo 배너)는 navigation 멈춤·loading.tsx 장시간 점유 원인이었음.
 */
export default function OverseasBrowseSlot({ searchParams }: Props) {
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
      initialSearchParams={searchParams}
      initialHubFocusedResults={initialHubFocusedResults}
      initialMegaMenuRegionCityGroupId={initialMegaMenuRegionCityGroupId}
      hubGalleryRotationSeed={createHubGalleryRotationSeed()}
    />
  )
}
