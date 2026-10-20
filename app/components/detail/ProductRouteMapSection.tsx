'use client'

import type { PublicRouteMapView } from '@/lib/bongtour-route-map-public'

type Props = {
  routeMap: PublicRouteMapView | null | undefined
}

/**
 * 등록 시 저장된 동선지도 — 조회 시 재생성하지 않음.
 * Client boundary: parent itinerary is a Client Component; keep SSR/hydrate JSX identical.
 */
export default function ProductRouteMapSection({ routeMap }: Props) {
  if (!routeMap?.showMap) return null

  const alt = routeMap.routeSummary || '동선지도'

  return (
    <section className="space-y-3" aria-labelledby="product-route-map-heading">
      <h2
        id="product-route-map-heading"
        className="border-l-4 border-[#1F1B2D] pl-3 text-lg md:text-xl font-black tracking-tight fit-tx-primary"
      >
        동선지도
      </h2>
      <div className="overflow-hidden rounded-2xl border border-[#DAD4EE] bg-white">
        {routeMap.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Object Storage 등록 맵 URL
          <img
            src={routeMap.imageUrl}
            alt={alt}
            className="mx-auto max-h-[min(70vh,520px)] w-full object-contain bg-[#FAFAF7]"
          />
        ) : (
          <div className="px-4 py-10 text-center text-sm fit-tx-meta">
            <p>
              {routeMap.status === 'generating'
                ? '동선지도를 준비하는 중입니다.'
                : routeMap.status === 'failed'
                  ? '동선지도를 아직 준비하지 못했습니다.'
                  : '저장된 동선지도가 없습니다.'}
            </p>
            <p className="mt-2 text-xs opacity-80">등록 시 생성되며, 이 화면에서 다시 그리지 않습니다.</p>
          </div>
        )}
        {routeMap.citiesCaption ? (
          <p className="border-t border-[#DAD4EE] px-4 py-3 text-center text-sm font-semibold fit-tx-primary">
            {routeMap.citiesCaption}
          </p>
        ) : null}
      </div>
    </section>
  )
}
