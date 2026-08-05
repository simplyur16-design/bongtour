import ProductsBrowseClient from '@/components/products/ProductsBrowseClient'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'

/**
 * browse 목록은 클라이언트가 캐시된 `/api/products/browse`로 로드 — RSC HTML 비대화 방지.
 * REGRESSION-FREEZE[air-hotel-hub-isr-cdn]: SSR query 미전달 — manifest
 */
export default function AirHotelBrowseSlot() {
  return (
    <ProductsBrowseClient
      hubBrowse
      basePath="/travel/air-hotel"
      defaultScope="overseas"
      pageTitle="항공+호텔"
      hidePageHeading
      initialSearchParams={null}
      initialHubFocusedResults={false}
      hubGalleryRotationSeed={createHubGalleryRotationSeed()}
    />
  )
}
