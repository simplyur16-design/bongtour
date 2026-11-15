import OverseasHubCatalogRoot from '@/app/components/travel/overseas/OverseasHubCatalogRoot'
import PublicProductSsrIndex from '@/components/seo/PublicProductSsrIndex'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'
import { listPublicProductsForSsrIndex } from '@/lib/public-product-ssr-index'

/**
 * 해외 허브 목록 — RSC에 전량 카탈로그를 실지 않음(메가메뉴 region 전환 시 ERR_CONNECTION_RESET 방지).
 * 카탈로그 fetch·필터·하위 분류는 `OverseasHubCatalogRoot`(client) SSOT.
 * REGRESSION-FREEZE[overseas-hub-isr-cdn]: SSR query 미전달 — manifest
 * REGRESSION-FREEZE[seo-list-ssr-index]: 로딩 자리에는 서버 렌더 상품 목록(최근 공개 패키지 일부, 링크+짧은 설명) — manifest
 */
export default async function OverseasBrowseSlot() {
  const ssrItems = await listPublicProductsForSsrIndex({ scope: 'overseas_package', limit: 36 })
  return (
    <OverseasHubCatalogRoot
      initialSearchParamsString=""
      hubGalleryRotationSeed={createHubGalleryRotationSeed()}
      ssrFallback={
        <PublicProductSsrIndex
          intro="해외 패키지 여행 상품 일부입니다. 지역·조건 검색은 위 메뉴에서 이용하세요."
          items={ssrItems}
          label="해외 패키지 여행 상품 목록"
        />
      }
    />
  )
}
