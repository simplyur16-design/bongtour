'use client'

import TravelProductDetail, {
  type TravelProduct,
} from '@/app/components/travel/TravelProductDetail'

type Props = {
  product: TravelProduct
  showEsimCrossSell?: boolean
}

/** 우리끼리(private) · 소그룹(semi) 패키지 상세 — 일반 travel과 동일 레이아웃 */
export default function PrivateTravelProductDetail({ product, showEsimCrossSell = false }: Props) {
  return <TravelProductDetail product={product} showEsimCrossSell={showEsimCrossSell} />
}
