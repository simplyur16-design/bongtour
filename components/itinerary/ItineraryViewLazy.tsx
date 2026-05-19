'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import { PulseBlock } from '@/components/route-loading/route-loading-primitives'
import type { ItineraryView } from '@/components/itinerary/ItineraryView'

const ItineraryViewDynamic = dynamic(
  () => import('@/components/itinerary/ItineraryView').then((m) => ({ default: m.ItineraryView })),
  {
    loading: () => (
      <div className="py-12" aria-busy="true" aria-label="일정 불러오는 중">
        <PulseBlock className="mx-auto h-40 max-w-4xl rounded-2xl" />
      </div>
    ),
  },
)

type Props = ComponentProps<typeof ItineraryView>

/** 에어텔 예시 일정 — 초기 JS 청크 분리(패키지 상세 전환 가속) */
export function ItineraryViewLazy(props: Props) {
  return <ItineraryViewDynamic {...props} />
}
