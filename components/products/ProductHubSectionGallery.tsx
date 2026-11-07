'use client'

import ProductHubGalleryGrid from '@/components/products/ProductHubGalleryGrid'
import ProductHubPcDoubleScrollRows from '@/components/products/ProductHubPcDoubleScrollRows'
import type { ResultItem } from '@/components/products/ProductResultsList'
import MobileDepartureGroupStack from '@/components/products/MobileDepartureGroupStack'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  rotationSeed: number
  scopeKey: string
  interleaveEsim?: boolean
  /** 모바일(lg 미만)만 출발공항 그룹. PC 줄은 그대로 */
  groupByMobileDeparture?: boolean
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
  groupByMobileDeparture = false,
}: Props) {
  if (items.length === 0) return null

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
        {groupByMobileDeparture ? (
          <MobileDepartureGroupStack
            items={items}
            renderItems={(groupItems, group) => (
              <ProductHubGalleryGrid
                items={groupItems}
                formatWon={formatWon}
                seasonalPickIds={seasonalPickIds}
                rotationSeed={rotationSeed}
                scopeKey={`${scopeKey}-${group}`}
                interleaveEsim={interleaveEsim}
              />
            )}
          />
        ) : (
          <ProductHubGalleryGrid
            items={items}
            formatWon={formatWon}
            seasonalPickIds={seasonalPickIds}
            rotationSeed={rotationSeed}
            scopeKey={scopeKey}
            interleaveEsim={interleaveEsim}
          />
        )}
      </div>
    </div>
  )
}
