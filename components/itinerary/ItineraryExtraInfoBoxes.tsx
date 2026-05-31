'use client'

import PackageOptionalToursTable from '@/app/components/detail/PackageOptionalToursTable'
import PackageShoppingTable from '@/app/components/detail/PackageShoppingTable'
import ModetourShoppingTable from '@/app/components/detail/ModetourShoppingTable'
import ShoppingFactSheet from '@/app/components/detail/ShoppingFactSheet'
import type { ShoppingStopRow } from '@/lib/public-product-extras-types'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import {
  ensureAirtelAirportTransferExcludedWhenNotInIncluded,
  filterPackagePublicIncludedExcludedLines,
  dropPublicExcludedMealBreakdownLines,
  organizePackageIncludedExcludedForPublicDisplay,
  splitIncludedExcludedForPublicDisplay,
} from '@/lib/product-included-excluded-public'
import { isAirHotelFreeListingForUi } from '@/lib/air-hotel-free-product-ui'

export type ItineraryExtraInfoProduct = {
  productType?: string | null
  listingKind?: string | null
  originSource?: string | null
  includedText?: string | null
  excludedText?: string | null
  optionalToursStructured?: string | null
  optionalToursPasteRaw?: string | null
  shoppingCount?: number | null
  shoppingVisitCountTotal?: number | null
  shoppingItems?: string | null
  shoppingPasteRaw?: string | null
  shoppingCautionNoticeRaw?: string | null
  reservationNoticeRaw?: string | null
  shoppingStopsStructured?: ShoppingStopRow[] | null
  airportTransferType?: string | null
}

type OptionalTourRow = {
  name?: string
  currency?: string
  adultPrice?: number | string
  childPrice?: number | string | null
  minPaxText?: string | null
  'guide同行Text'?: string | null
  waitingPlaceText?: string | null
}

type ItineraryExtraInfoSection = 'top' | 'bottom' | 'all'
type ItineraryExtraInfoLayout = 'default' | 'split'

function isPackageProductType(productType: string | null | undefined): boolean {
  const t = (productType ?? '').toLowerCase()
  return t === 'travel' || t === 'private' || t === 'semi'
}

export function ItineraryExtraInfoBoxes({
  product,
  section = 'all',
  layout = 'default',
}: {
  product: ItineraryExtraInfoProduct
  section?: ItineraryExtraInfoSection
  layout?: ItineraryExtraInfoLayout
}) {
  const showTop = section === 'top' || section === 'all'
  const showBottom = section === 'bottom' || section === 'all'
  const isSplitLayout = layout === 'split'
  const isPackage = isPackageProductType(product.productType)
  const isAirHotelFree = isAirHotelFreeListingForUi(product.listingKind)
  const isAirtel = product.productType === 'airtel'
  const usePackageIncludedExcludedRules = isPackage || isAirHotelFree || isAirtel

  let includedItems: string[]
  let excludedItems: string[]
  let includedFootnotes: string[] = []
  if (usePackageIncludedExcludedRules) {
    const split = organizePackageIncludedExcludedForPublicDisplay(
      splitIncludedExcludedForPublicDisplay(product.includedText, product.excludedText)
    )
    includedItems = filterPackagePublicIncludedExcludedLines(split.includedLines)
    excludedItems = split.excludedLines
    includedFootnotes = split.includedFootnotes
  } else {
    includedItems = (product.includedText ?? '')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    excludedItems = dropPublicExcludedMealBreakdownLines(
      (product.excludedText ?? '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
    )
  }

  if (isAirtel) {
    const adjusted = ensureAirtelAirportTransferExcludedWhenNotInIncluded({
      includedLines: includedItems,
      excludedLines: excludedItems,
      excludedText: product.excludedText,
    })
    includedItems = adjusted.includedLines
    excludedItems = adjusted.excludedLines
  }

  const reservationNotices = (product.reservationNoticeRaw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const optionalTours = (() => {
    try {
      const parsed = product.optionalToursStructured ? JSON.parse(product.optionalToursStructured) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })() as OptionalTourRow[]

  const shoppingItems = (product.shoppingItems ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const isModetour = normalizeSupplierOrigin(product.originSource) === 'modetour'
  const isHanatour = normalizeSupplierOrigin(product.originSource) === 'hanatour'
  const shoppingVisitCountForUi = isHanatour
    ? (product.shoppingVisitCountTotal ?? null)
    : (product.shoppingCount ?? product.shoppingVisitCountTotal ?? null)

  return (
    <div className={isSplitLayout ? '' : 'space-y-2'}>
      {showTop && (includedItems.length > 0 || excludedItems.length > 0) && (
        <div className={isSplitLayout ? 'grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6' : undefined}>
          {includedItems.length > 0 && (
            <section className={isSplitLayout ? '' : 'mb-4'}>
              <div className="mb-2 border-l-4 border-[#6B8E5C] pl-3">
                <h3 className="text-base font-bold fit-tx-primary">포함 사항</h3>
              </div>
              <ul
                className={
                  usePackageIncludedExcludedRules
                    ? 'space-y-2 rounded-2xl border border-[#DAD4EE] bg-white p-4'
                    : 'space-y-2 rounded-2xl bg-green-50 p-4'
                }
              >
                {includedItems.map((item, i) => (
                  <li key={i} className="bt-wrap text-sm fit-tx-primary">
                    {item}
                  </li>
                ))}
              </ul>
              {usePackageIncludedExcludedRules && includedFootnotes.length > 0 ? (
                <div className="mt-2 space-y-1 px-1">
                  {includedFootnotes.map((line, i) => (
                    <p key={i} className="bt-wrap text-xs leading-relaxed text-bt-meta">
                      {line}
                    </p>
                  ))}
                </div>
              ) : null}
            </section>
          )}

          {excludedItems.length > 0 && (
            <section className={isSplitLayout ? '' : 'mb-4'}>
              <div className="mb-2 border-l-4 border-[#D85A30] pl-3">
                <h3 className="text-base font-bold fit-tx-primary">불포함 사항</h3>
              </div>
              <ul
                className={
                  usePackageIncludedExcludedRules
                    ? 'space-y-2 rounded-2xl border border-[#DAD4EE] bg-white p-4'
                    : 'space-y-2 rounded-2xl bg-orange-50 p-4'
                }
              >
                {excludedItems.map((item, i) => (
                  <li key={i} className="bt-wrap whitespace-pre-wrap text-sm fit-tx-primary">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {showTop && usePackageIncludedExcludedRules && !isAirtel ? (
        <div className="space-y-4">
          <PackageOptionalToursTable
            optionalToursStructured={product.optionalToursStructured}
            optionalToursPasteRaw={product.optionalToursPasteRaw ?? null}
          />
          {!isAirHotelFree ? (
            isModetour ? (
              <ModetourShoppingTable
                stops={product.shoppingStopsStructured}
                shoppingCount={shoppingVisitCountForUi}
                shoppingPasteRaw={product.shoppingPasteRaw ?? null}
                shoppingItems={product.shoppingItems}
                shoppingNoticeRaw={product.shoppingCautionNoticeRaw}
              />
            ) : isHanatour ? (
              <ShoppingFactSheet
                embedded
                originSource={product.originSource ?? null}
                shoppingCount={shoppingVisitCountForUi ?? 0}
                visitCountTotal={product.shoppingVisitCountTotal ?? null}
                shoppingItems={product.shoppingItems ?? null}
                shoppingNoticeRaw={product.shoppingCautionNoticeRaw ?? null}
                shoppingPasteRaw={product.shoppingPasteRaw ?? null}
                structuredStops={product.shoppingStopsStructured ?? undefined}
              />
            ) : (
              <PackageShoppingTable
                stops={product.shoppingStopsStructured}
                shoppingCount={shoppingVisitCountForUi}
                visitCountTotal={product.shoppingVisitCountTotal ?? null}
                shoppingPasteRaw={product.shoppingPasteRaw ?? null}
                shoppingItems={product.shoppingItems}
                shoppingNoticeRaw={product.shoppingCautionNoticeRaw}
              />
            )
          ) : null}
        </div>
      ) : null}

      {showBottom && !isAirtel && !usePackageIncludedExcludedRules && optionalTours.length > 0 && (
        <section className="mb-6">
          <div className="border-l-4 border-[#1F1B2D] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">현지 옵션</h3>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">옵션명</th>
                  <th className="px-3 py-2 text-right font-medium">성인가</th>
                  <th className="px-3 py-2 text-right font-medium">아동가</th>
                  <th className="px-3 py-2 text-center font-medium">최소인원</th>
                  <th className="px-3 py-2 text-center font-medium">가이드</th>
                  <th className="px-3 py-2 text-left font-medium">대기 장소</th>
                </tr>
              </thead>
              <tbody>
                {optionalTours.map((t, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap">{t.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.currency}
                      {t.adultPrice}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.childPrice ? `${t.currency}${t.childPrice}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">{t.minPaxText || '-'}</td>
                    <td className="px-3 py-2 text-center">{t['guide同行Text'] || '-'}</td>
                    <td className="px-3 py-2">{t.waitingPlaceText || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showBottom && !isAirtel && !usePackageIncludedExcludedRules && Boolean(product.shoppingCount) && shoppingItems.length > 0 && (
        <section className="mb-6">
          <div className="border-l-4 border-[#E89571] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">
              쇼핑 정보{' '}
              <span className="text-sm font-normal text-gray-500 ml-2">총 {product.shoppingCount}회</span>
            </h3>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-center font-medium w-16">#</th>
                  <th className="px-3 py-2 text-left font-medium">쇼핑 품목</th>
                </tr>
              </thead>
              <tbody>
                {shoppingItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-center tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">{item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {product.shoppingCautionNoticeRaw ? (
            <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{product.shoppingCautionNoticeRaw}</p>
          ) : null}
        </section>
      )}

      {showBottom && reservationNotices.length > 0 && (
        <section className="mb-4">
          <div className="border-l-4 border-[#8B8B95] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">꼭 알아야 할 사항</h3>
          </div>
          <ul className="bg-gray-50 rounded-2xl p-4 space-y-2">
            {reservationNotices.map((item, i) => (
              <li key={i} className="text-sm fit-tx-primary">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
