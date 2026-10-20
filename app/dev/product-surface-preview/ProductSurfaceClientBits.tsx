'use client'

import dynamic from 'next/dynamic'
import type { BongtourBenefitIconKey } from '@/lib/bongtour-benefit-icon-ssot'

const BenefitRow = dynamic(() => import('./ProductSurfaceBenefitRow'), {
  ssr: false,
  loading: () => null,
})

const MapImage = dynamic(() => import('./RouteMapGeminiImage'), {
  ssr: false,
  loading: () => (
    <div className="ps-map-loading" role="status">
      <p>동선지도 준비 중…</p>
    </div>
  ),
})

type Edge = { from: number; to: number; label: string; mode?: string }
type Node = { order: number; city: string }

type Props = {
  mode: 'benefits' | 'map'
  benefitIcons: BongtourBenefitIconKey[]
  productKey: string
  routeSummary: string
  nodes: Node[]
  edges: Edge[]
}

export default function ProductSurfaceClientBits({
  mode,
  benefitIcons,
  productKey,
  routeSummary,
  nodes,
  edges,
}: Props) {
  if (mode === 'benefits') {
    return <BenefitRow icons={benefitIcons} />
  }
  return (
    <MapImage productKey={productKey} routeSummary={routeSummary} nodes={nodes} edges={edges} />
  )
}
