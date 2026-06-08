'use client'

import ProductHubGalleryGrid from '@/components/products/ProductHubGalleryGrid'
import ProductHubPcDoubleScrollRows from '@/components/products/ProductHubPcDoubleScrollRows'
import type { ResultItem } from '@/components/products/ProductResultsList'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  rotationSeed: number
  scopeKey: string
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
        />
      </div>
      <div className="lg:hidden">
        <ProductHubGalleryGrid
          items={items}
          formatWon={formatWon}
          seasonalPickIds={seasonalPickIds}
          rotationSeed={rotationSeed}
          scopeKey={scopeKey}
        />
      </div>
    </div>
  )
}
