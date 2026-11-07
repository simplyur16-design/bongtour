'use client'

import ProductHubGalleryGrid from '@/components/products/ProductHubGalleryGrid'
import ProductHubPcDoubleScrollRows from '@/components/products/ProductHubPcDoubleScrollRows'
import type { ResultItem } from '@/components/products/ProductResultsList'
import { selectMobileDepartureItems, type MobileDeparturePick } from '@/lib/mobile-departure-group'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  rotationSeed: number
  scopeKey: string
  interleaveEsim?: boolean
  /** 모바일(lg 미만)만 이 출발지로 거른다. PC 줄은 전체 */
  mobileDeparturePick?: MobileDeparturePick
}

/**
 * 해외·자유여행 허브 상품 블록
 * - PC(`lg+`): 메인메뉴 동일 카드 4열 폭 가로 스크롤
 * - 모바일: 대표 1(상단) + 작은 카드 2장 가로 스크롤
 */
export default function ProductHubSectionGallery({
  items,
  formatWon,
  seasonalPickIds,
  rotationSeed,
  scopeKey,
  interleaveEsim = false,
  mobileDeparturePick,
}: Props) {
  if (items.length === 0) return null
  const mobileItems = mobileDeparturePick ? selectMobileDepartureItems(items, mobileDeparturePick) : items

  return (
    <div className="mt-4 w-full min-w-0">
      <div className="hidden w-full min-w-0 lg:block">
        <ProductHubPcDoubleScrollRows
          items={items}
          formatWon={formatWon}
          seasonalPickIds={seasonalPickIds}
          scopeKey={scopeKey}
          interleaveEsim={interleaveEsim}
        />
      </div>
      <div className="lg:hidden">
        {mobileItems.length === 0 ? null : (
          <ProductHubGalleryGrid
            items={mobileItems}
            formatWon={formatWon}
            seasonalPickIds={seasonalPickIds}
            rotationSeed={rotationSeed}
            scopeKey={mobileDeparturePick ? `${scopeKey}-${mobileDeparturePick}` : scopeKey}
            interleaveEsim={interleaveEsim}
          />
        )}
      </div>
    </div>
  )
}
