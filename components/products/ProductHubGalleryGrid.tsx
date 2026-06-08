'use client'

import { useMemo } from 'react'
import {
  HUB_MOBILE_SMALL_CARD_CELL_WIDTH_CLASS,
  HUB_MOBILE_SMALL_CARD_ROW_CLASS,
} from '@/lib/hub-main-menu-card-layout'
import { splitHeroPlusSmall } from '@/lib/hub-gallery-rotation'
import HubProductCardScrollRow from '@/components/products/HubProductCardScrollRow'
import { ProductResultCard, type ResultItem } from '@/components/products/ProductResultsList'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  rotationSeed: number
  scopeKey: string
}

/** 모바일 — 큰 카드 1(상단) + 작은 카드 2장 노출 가로 스크롤 */
export default function ProductHubGalleryGrid({
  items,
  formatWon,
  seasonalPickIds,
  rotationSeed,
  scopeKey,
}: Props) {
  const { featured } = useMemo(
    () => splitHeroPlusSmall(items, rotationSeed, scopeKey),
    [items, rotationSeed, scopeKey],
  )

  const smallCards = featured ? items.filter((it) => it.id !== featured.id) : items

  if (!featured && items.length === 0) return null

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:gap-4">
      {featured ? (
        <div className="min-w-0">
          <ProductResultCard
            item={featured}
            formatWon={formatWon}
            seasonalPickBadge={Boolean(seasonalPickIds?.has(featured.id))}
          />
        </div>
      ) : null}
      {smallCards.length > 0 ? (
        <HubProductCardScrollRow
          ariaLabel={`${scopeKey} 상품`}
          scrollClassName={HUB_MOBILE_SMALL_CARD_ROW_CLASS}
        >
          {smallCards.map((item) => (
            <li key={item.id} className={HUB_MOBILE_SMALL_CARD_CELL_WIDTH_CLASS}>
              <ProductResultCard
                item={item}
                formatWon={formatWon}
                seasonalPickBadge={Boolean(seasonalPickIds?.has(item.id))}
              />
            </li>
          ))}
        </HubProductCardScrollRow>
      ) : null}
    </div>
  )
}
