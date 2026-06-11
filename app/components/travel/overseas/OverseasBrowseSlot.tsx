import OverseasHubCatalogRoot from '@/app/components/travel/overseas/OverseasHubCatalogRoot'
import { createHubGalleryRotationSeed } from '@/lib/hub-gallery-rotation'
import { searchParamsRecordToUrlSearchParams } from '@/lib/products-browse-hub-query'

type Props = {
  searchParams: Record<string, string | string[] | undefined>
}

/**
 * 해외 허브 목록 — RSC에 전량 카탈로그를 실지 않음(메가메뉴 region 전환 시 ERR_CONNECTION_RESET 방지).
 * 카탈로그 fetch·필터·하위 분류는 `OverseasHubCatalogRoot`(client) SSOT.
 */
export default function OverseasBrowseSlot({ searchParams }: Props) {
  const initialSearchParamsString = searchParamsRecordToUrlSearchParams(searchParams).toString()

  return (
    <OverseasHubCatalogRoot
      initialSearchParamsString={initialSearchParamsString}
      hubGalleryRotationSeed={createHubGalleryRotationSeed()}
    />
  )
}
