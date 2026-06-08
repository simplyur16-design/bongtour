import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { computeHubFocusedResultsFromRecord } from '@/lib/hub-focused-results'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'
import { prefetchAirHotelHubBrowse } from '@/lib/products-browse-server-prefetch'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

export default async function AirHotelBrowseSlot({ searchParams }: Props) {
  try {
    const hubBrowse = await prefetchAirHotelHubBrowse(searchParams)
    return (
      <ProductsBrowseClient
        basePath="/travel/air-hotel"
        defaultScope="overseas"
        pageTitle="항공+호텔"
        hidePageHeading
        initialBrowse={hubBrowse?.payload ?? null}
        initialBrowseQueryKey={hubBrowse?.queryKey ?? null}
        initialSearchParams={searchParams}
        initialHubFocusedResults={computeHubFocusedResultsFromRecord(searchParams, {
          pathname: '/travel/air-hotel',
          defaultScope: 'overseas',
        })}
        hubGalleryRotationSeed={createHubGalleryRotationSeed()}
      />
    )
  } catch (e) {
    console.error('[AirHotelBrowseSlot]', e)
    return (
      <p className="py-16 text-center text-sm text-slate-600">
        상품 목록을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.
      </p>
    )
  }
}
