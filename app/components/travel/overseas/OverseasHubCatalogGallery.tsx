'use client'

import { useState } from 'react'
import ProductHubSectionGallery from '@/components/products/ProductHubSectionGallery'
import {
  MobileDepartureEmptyGroup,
  MobileDeparturePickButtons,
} from '@/components/products/MobileDepartureGroupStack'
import {
  DEFAULT_MOBILE_DEPARTURE_PICK,
  selectMobileDepartureItems,
  type MobileDeparturePick,
} from '@/lib/mobile-departure-group'
import type { OverseasHubCatalogSection } from '@/lib/overseas-hub-catalog-sections'

type Props = {
  sections: OverseasHubCatalogSection[]
  rotationSeed: number
  emptyMessage?: string
}

function formatWon(n: number | null) {
  if (n == null) return '문의'
  return `${n.toLocaleString('ko-KR')}원~`
}

/**
 * 해외 허브 상품 갤러리 — fetch·loading 없음. 서버가 sections를 계산해 전달.
 */
export default function OverseasHubCatalogGallery({
  sections,
  rotationSeed,
  emptyMessage = '등록된 여행상품이 없습니다.',
}: Props) {
  const [pick, setPick] = useState<MobileDeparturePick>(DEFAULT_MOBILE_DEPARTURE_PICK)
  if (sections.length === 0) {
    return <p className="mt-10 text-center text-sm text-slate-600">{emptyMessage}</p>
  }

  const mobileHasItems = sections.some(
    (section) => selectMobileDepartureItems(section.items, pick).length > 0,
  )

  return (
    <>
      <div className="lg:hidden">
        <MobileDeparturePickButtons pick={pick} onChange={setPick} />
        {mobileHasItems ? null : <MobileDepartureEmptyGroup />}
      </div>
      {sections.map((section) => {
        const mobileCount = selectMobileDepartureItems(section.items, pick).length
        return (
          <section
            key={section.key}
            className={
              mobileCount === 0
                ? 'mt-8 hidden scroll-mt-4 lg:mt-8 lg:block'
                : 'mt-8 scroll-mt-4 first:mt-4'
            }
          >
            {section.label ? (
              <h2 className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900">
                {section.label}
              </h2>
            ) : null}
            <ProductHubSectionGallery
              items={section.items}
              formatWon={formatWon}
              seasonalPickIds={
                section.seasonalPickIds.length > 0 ? new Set(section.seasonalPickIds) : null
              }
              rotationSeed={rotationSeed}
              scopeKey={`overseas-${section.key}`}
              mobileDeparturePick={pick}
            />
          </section>
        )
      })}
    </>
  )
}
