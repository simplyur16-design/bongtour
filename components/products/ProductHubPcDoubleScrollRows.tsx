'use client'

import {
  HUB_PC_CARD_ROW_CLASS,
  MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS,
} from '@/lib/hub-main-menu-card-layout'
import HubProductCardScrollRow from '@/components/products/HubProductCardScrollRow'
import EsimProductListNativeCard from '@/app/components/travel/EsimProductListNativeCard'
import { ProductResultCard, type ResultItem } from '@/components/products/ProductResultsList'

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  seasonalPickIds?: ReadonlySet<string> | null
  scopeKey: string
  interleaveEsim?: boolean
}

/** PC — 메인메뉴와 동일 카드·동일 4열 폭, 좌우 스크롤 + 화살표 */
export default function ProductHubPcDoubleScrollRows({
  items,
  formatWon,
  seasonalPickIds,
  scopeKey,
  interleaveEsim = false,
}: Props) {
  if (items.length === 0) return null

  return (
    <HubProductCardScrollRow ariaLabel={`${scopeKey} 상품`} scrollClassName={HUB_PC_CARD_ROW_CLASS}>
      {interleaveEsim ? (
        <li key="esim-native-lead" className={MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS}>
          <EsimProductListNativeCard />
        </li>
      ) : null}
      {items.flatMap((item, i) => {
        const nodes = [
          <li key={item.id} className={MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS}>
            <ProductResultCard
              item={item}
              formatWon={formatWon}
              seasonalPickBadge={Boolean(seasonalPickIds?.has(item.id))}
            />
          </li>,
        ]
        if (interleaveEsim && (i + 1) % 10 === 0 && i < items.length - 1) {
          nodes.push(
            <li key={`esim-native-${i}`} className={MAIN_MENU_PC_CARD_CELL_WIDTH_CLASS}>
              <EsimProductListNativeCard />
            </li>,
          )
        }
        return nodes
      })}
    </HubProductCardScrollRow>
  )
}
