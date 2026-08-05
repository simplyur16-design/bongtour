import OverseasHubCatalogRoot from '@/app/components/travel/overseas/OverseasHubCatalogRoot'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'

/**
 * 해외 허브 목록 — RSC에 전량 카탈로그를 실지 않음(메가메뉴 region 전환 시 ERR_CONNECTION_RESET 방지).
 * 카탈로그 fetch·필터·하위 분류는 `OverseasHubCatalogRoot`(client) SSOT.
 * REGRESSION-FREEZE[overseas-hub-isr-cdn]: SSR query 미전달 — manifest
 */
export default function OverseasBrowseSlot() {
  return (
    <OverseasHubCatalogRoot
      initialSearchParamsString=""
      hubGalleryRotationSeed={createHubGalleryRotationSeed()}
    />
  )
}
