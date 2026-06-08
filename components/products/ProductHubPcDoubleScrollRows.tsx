'use client'

import {
  HUB_PC_CARD_ROW_CLASS,
  MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS,
} from '@/lib/hub-main-menu-card-layout'
import HubProductCardScrollRow from '@/components/products/HubProductCardScrollRow'
import { ProductResultCard, type ResultItem } from '@/components/products/ProductResultsList'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  scopeKey: string
}

/** PC — 메인메뉴와 동일 카드·동일 4열 폭, 좌우 스크롤 + 화살표 */
export default function ProductHubPcDoubleScrollRows({
  items,
  formatWon,
  seasonalPickIds,
  scopeKey,
}: Props) {
  if (items.length === 0) return null

  return (
    <HubProductCardScrollRow ariaLabel={`${scopeKey} 상품`} scrollClassName={HUB_PC_CARD_ROW_CLASS}>
      {items.map((item) => (
        <li key={item.id} className={MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS}>
          <ProductResultCard
            item={item}
            formatWon={formatWon}
            seasonalPickBadge={Boolean(seasonalPickIds?.has(item.id))}
          />
        </li>
      ))}
    </HubProductCardScrollRow>
  )
}
