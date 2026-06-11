import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { computeHubFocusedResultsFromRecord } from '@/lib/hub-focused-results'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

/** browse 목록은 클라이언트가 캐시된 `/api/products/browse`로 로드 — RSC HTML 비대화 방지 */
export default function AirHotelBrowseSlot({ searchParams }: Props) {
  return (
    <ProductsBrowseClient
      hubBrowse
      basePath="/travel/air-hotel"
      defaultScope="overseas"
      pageTitle="항공+호텔"
      hidePageHeading
      initialSearchParams={searchParams}
      initialHubFocusedResults={computeHubFocusedResultsFromRecord(searchParams, {
        pathname: '/travel/air-hotel',
        defaultScope: 'overseas',
      })}
      hubGalleryRotationSeed={createHubGalleryRotationSeed()}
    />
  )
}
