'use client'

import ProductHubSectionGallery from '@/components/products/ProductHubSectionGallery'
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
  if (sections.length === 0) {
    return <p className="mt-10 text-center text-sm text-slate-600">{emptyMessage}</p>
  }

  return (
    <>
      {sections.map((section) => (
        <section key={section.key} className="mt-8 scroll-mt-4 first:mt-4">
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
          />
        </section>
      ))}
    </>
  )
}
