'use client'

import Link from 'next/link'
import { Fragment, useMemo } from 'react'
import OverseasDestinationBriefingMid from '@/components/products/OverseasDestinationBriefingMid'
import OverseasMonthlyCurationMid from '@/components/products/OverseasMonthlyCurationMid'
import type { MonthlyCurationMidPayload } from '@/lib/overseas-cms-public'
import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import {
  OVERSEAS_DISPLAY_BUCKET_LABEL,
  OVERSEAS_DISPLAY_BUCKET_ORDER,
  type OverseasDisplayBucketId,
} from '@/lib/overseas-display-buckets'
import PublicImageBottomOverlay from '@/app/components/ui/PublicImageBottomOverlay'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'
import { interleaveProductsBySupplier } from '@/lib/interleave-products-by-supplier'

export type ResultItem = {
  id: string
  title: string
  originSource: string
  productType: string | null
  /** 항공권+호텔(자유여행) 등 — 에어텔 UI 게이트용 */
  listingKind?: string | null
  airportTransferType?: string | null
  primaryDestination: string | null
  primaryRegion?: string | null
  duration: string | null
  bgImageUrl: string | null
  coverImageUrl?: string | null
  coverImageSeoKeyword?: string | null
  coverImageSourceUserLabel?: string | null
  effectivePricePerPersonKrw: number | null
  hotelName?: string | null
  hotelGrade?: string | null
  roomType?: string | null
  /** scope=overseas 시 browse API가 채움 */
  overseasBucket?: OverseasDisplayBucketId
  countryRowLabel?: string | null
}

type Props = {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  /** `/travel/overseas` 해외 허브만 권역 버킷별 한 줄 목록 */
  groupOverseasByRegion?: boolean
  /** `/travel/air-hotel`만: browse `countryRowLabel` 기준 나라 섹션 + 섹션 내 공급사 interleave */
  groupAirHotelByCountry?: boolean
  /** 서유럽 섹션 상단 목적지 브리핑(선택) */
  overseasEditorialBriefing?: OverseasEditorialBriefingPayload | null
  /** 동유럽 섹션 직후·미주 전, 전폭 1회(데이터 없으면 미렌더) */
  monthlyCurationMid?: MonthlyCurationMidPayload | null
}

const AIR_HOTEL_MISC_SECTION = '기타'

/** browse `countryRowLabel` → 섹션 키(최소 보수 정리만) */
function normalizeAirHotelCountrySectionKey(raw: string | null | undefined): string {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return AIR_HOTEL_MISC_SECTION
  if (/[\n\r\t]/.test(t)) return AIR_HOTEL_MISC_SECTION
  if (t.length > 56) return AIR_HOTEL_MISC_SECTION
  return t
}

function AirHotelCountryGroupedList({
  items,
  formatWon,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
}) {
  const sections = useMemo(() => {
    const byCountry = new Map<string, ResultItem[]>()
    for (const item of items) {
      const key = normalizeAirHotelCountrySectionKey(item.countryRowLabel)
      let arr = byCountry.get(key)
      if (!arr) {
        arr = []
        byCountry.set(key, arr)
      }
      arr.push(item)
    }
    const entries = [...byCountry.entries()].filter(([, list]) => list.length > 0)
    const nonMisc = entries
      .filter(([k]) => k !== AIR_HOTEL_MISC_SECTION)
      .sort((a, b) => {
        const dc = b[1].length - a[1].length
        if (dc !== 0) return dc
        return a[0].localeCompare(b[0], 'ko')
      })
    const misc = entries.find(([k]) => k === AIR_HOTEL_MISC_SECTION)
    const ordered: { countryKey: string; items: ResultItem[] }[] = nonMisc.map(([countryKey, list]) => ({
      countryKey,
      items: interleaveProductsBySupplier(list),
    }))
    if (misc && misc[1].length > 0) {
      ordered.push({ countryKey: misc[0], items: interleaveProductsBySupplier(misc[1]) })
    }
    return ordered
  }, [items])

  return (
    <div className="mt-6 space-y-10">
      {sections.map(({ countryKey, items: rowItems }, idx) => (
        <section key={countryKey} className="scroll-mt-4" aria-labelledby={`air-hotel-sec-${idx}`}>
          <h2
            id={`air-hotel-sec-${idx}`}
            className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
          >
            {countryKey}
          </h2>
          <ul className={cardGridClass} role="list">
            {rowItems.map((item) => (
              <li key={item.id}>
                <ProductResultCard item={item} formatWon={formatWon} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** 일반 목록용 그리드 */
const cardGridClass = 'mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/** 해외 여행상품: 권역(버킷)당 한 줄 — 약 3장 노출, 나머지는 가로 스크롤(데스크톱에서도 줄바꿈 없음) */
const countryProductRowClass =
  'mt-6 flex flex-nowrap gap-4 overflow-x-auto overflow-y-visible overscroll-x-contain pb-2 pt-0.5 snap-x snap-proximity [-ms-overflow-style:none] [scrollbar-width:thin] [-webkit-overflow-scrolling:touch]'

export function ProductResultCard({
  item,
  formatWon,
}: {
  item: ResultItem
  formatWon: (n: number | null) => string
}) {
  return (
    <Link
      href={`/products/${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full bg-slate-100">
        {item.coverImageUrl || item.bgImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote image hosts */}
            <img
              src={item.coverImageUrl ?? item.bgImageUrl ?? ''}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <PublicImageBottomOverlay
              leftLabel={item.coverImageSeoKeyword ?? null}
              rightLabel={item.coverImageSourceUserLabel ?? null}
            />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">이미지 없음</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium text-slate-500">{formatOriginSourceForDisplay(item.originSource)}</p>
        <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-teal-800">
          {item.title}
        </h2>
        {item.primaryDestination && <p className="mt-1 text-xs text-slate-600">{item.primaryDestination}</p>}
        {isAirHotelFreeListingForUi(item.listingKind) && (item.hotelName || item.hotelGrade || item.roomType) && (
          <p className="mt-1 text-xs text-slate-600">
            {item.hotelName ?? '호텔 정보 확인'}
            {item.hotelGrade ? ` · ${item.hotelGrade}` : ''}
            {item.roomType ? ` · ${item.roomType}` : ''}
          </p>
        )}
        {isAirHotelFreeListingForUi(item.listingKind) && item.airportTransferType && (
          <p className="mt-1">
            <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
              {item.airportTransferType === 'BOTH'
                ? '픽업·샌딩 포함'
                : item.airportTransferType === 'PICKUP'
                  ? '공항 픽업 포함'
                  : item.airportTransferType === 'SENDING'
                    ? '공항 샌딩 포함'
                    : '공항 이동 불포함'}
            </span>
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3">
          <span className="text-base font-bold text-slate-900">{formatWon(item.effectivePricePerPersonKrw)}</span>
          {item.duration && <span className="text-xs text-slate-500">{item.duration}</span>}
        </div>
      </div>
    </Link>
  )
}

function flattenBucketItems(
  bucketId: OverseasDisplayBucketId,
  bucketToCountries: Map<OverseasDisplayBucketId, Map<string, ResultItem[]>>
): ResultItem[] {
  const countryMap = bucketToCountries.get(bucketId)
  if (!countryMap) return []
  const entries = [...countryMap.entries()].filter(([, list]) => list.length > 0)
  entries.sort(([a], [b]) => a.localeCompare(b, 'ko'))
  return entries.flatMap(([, list]) => list)
}

function OverseasRegionGroupedList({
  items,
  formatWon,
  editorialBriefing,
  monthlyCurationMid,
}: {
  items: ResultItem[]
  formatWon: (n: number | null) => string
  editorialBriefing: OverseasEditorialBriefingPayload | null | undefined
  monthlyCurationMid: MonthlyCurationMidPayload | null | undefined
}) {
  const bucketToCountries = useMemo(() => {
    const map = new Map<OverseasDisplayBucketId, Map<string, ResultItem[]>>()
    for (const id of OVERSEAS_DISPLAY_BUCKET_ORDER) {
      map.set(id, new Map())
    }
    for (const item of items) {
      const bucket: OverseasDisplayBucketId = item.overseasBucket ?? 'other'
      const country = (item.countryRowLabel ?? '기타').trim() || '기타'
      if (!map.has(bucket)) map.set(bucket, new Map())
      const inner = map.get(bucket)!
      if (!inner.has(country)) inner.set(country, [])
      inner.get(country)!.push(item)
    }
    return map
  }, [items])

  const interleavedByBucket = useMemo(() => {
    const out = new Map<OverseasDisplayBucketId, ResultItem[]>()
    for (const bucketId of OVERSEAS_DISPLAY_BUCKET_ORDER) {
      const raw = flattenBucketItems(bucketId, bucketToCountries)
      out.set(bucketId, interleaveProductsBySupplier(raw))
    }
    return out
  }, [bucketToCountries])

  return (
    <div className="mt-6 space-y-12">
      {OVERSEAS_DISPLAY_BUCKET_ORDER.map((bucketId) => {
        const flatList = interleavedByBucket.get(bucketId) ?? []
        const showEuropeBriefing = bucketId === 'europe_west' && editorialBriefing
        const section =
          flatList.length === 0 && !showEuropeBriefing ? null : (
            <section className="scroll-mt-4" aria-labelledby={`overseas-bucket-${bucketId}`}>
              <h2
                id={`overseas-bucket-${bucketId}`}
                className="border-b border-slate-200 pb-2 text-lg font-bold tracking-tight text-slate-900"
              >
                {OVERSEAS_DISPLAY_BUCKET_LABEL[bucketId]}
              </h2>
              {showEuropeBriefing ? (
                <div className="mt-5">
                  <OverseasDestinationBriefingMid {...editorialBriefing} />
                </div>
              ) : null}
              {flatList.length > 0 ? (
                <ul className={countryProductRowClass} role="list">
                  {flatList.map((item) => (
                    <li
                      key={item.id}
                      className="w-[min(17.5rem,calc(100vw-2.75rem))] shrink-0 snap-start sm:w-[min(19rem,calc((100vw-3rem)/2))] lg:w-[calc((100% - 2rem) / 3)] lg:min-w-0 lg:max-w-none"
                    >
                      <ProductResultCard item={item} formatWon={formatWon} />
                    </li>
                  ))}
                </ul>
              ) : showEuropeBriefing ? (
                <p className="mt-4 text-sm text-slate-500">현재 조건에 맞는 서유럽 상품이 없습니다.</p>
              ) : null}
            </section>
          )
        return (
          <Fragment key={bucketId}>
            {section}
            {bucketId === 'europe_east' && monthlyCurationMid ? (
              <section className="scroll-mt-4 w-full" aria-label="이번 달 추천 해외여행">
                <OverseasMonthlyCurationMid {...monthlyCurationMid} />
              </section>
            ) : null}
          </Fragment>
        )
      })}
    </div>
  )
}

export default function ProductResultsList({
  items,
  formatWon,
  groupOverseasByRegion,
  groupAirHotelByCountry = false,
  overseasEditorialBriefing = null,
  monthlyCurationMid = null,
}: Props) {
  if (groupAirHotelByCountry && items.length > 0) {
    return <AirHotelCountryGroupedList items={items} formatWon={formatWon} />
  }

  const hasBucketMeta = items.some((i) => i.overseasBucket != null || i.countryRowLabel != null)
  const useGrouped =
    groupOverseasByRegion &&
    (hasBucketMeta ||
      monthlyCurationMid != null ||
      overseasEditorialBriefing != null)

  if (useGrouped) {
    return (
      <OverseasRegionGroupedList
        items={items}
        formatWon={formatWon}
        editorialBriefing={overseasEditorialBriefing}
        monthlyCurationMid={monthlyCurationMid}
      />
    )
  }

  return (
    <ul className={cardGridClass}>
      {items.map((item) => (
        <li key={item.id}>
          <ProductResultCard item={item} formatWon={formatWon} />
        </li>
      ))}
    </ul>
  )
}
