'use client'

import { Fragment, useMemo, useState, type ReactNode } from 'react'
import type { TravelProduct } from '@/app/components/travel/verygood/VerygoodTravelProductDetail'
import StructuredLocalOptionsSection from '@/app/components/detail/StructuredLocalOptionsSection'
import OptionalToursFactSheet from '@/app/components/detail/OptionalToursFactSheet'
import ShoppingFactSheet from '@/app/components/detail/ShoppingFactSheet'
import type { UiOptionalTourRow } from '@/lib/optional-tours-ui-model'
import {
  type PublicOptionalDisplayInput,
  type PublicShoppingDisplayInput,
  type ShoppingStopRow,
  shouldShowLegacyOptionalSheetForPublic,
  shouldShowOptionalPasteFallback,
  shouldShowOptionalStructuredNoticeUi,
  shouldShowPublicOptionalSection,
  shouldShowPublicShoppingSection,
} from '@/lib/public-product-extras'
import { parseAirtelHotelInfoPublic } from '@/lib/parse-airtel-hotel-info'
import { mergeExcludedWithSingleRoomSurcharge } from '@/lib/product-excluded-display'
import {
  formatPublicExcludedTextAfterMerge,
  splitIncludedExcludedForPublicDisplay,
} from '@/lib/product-included-excluded-public'
import { mergeModetourExcludedWithSingleRoomForPublicTab } from '@/lib/modetour-product-public-display'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import {
  SUPPLIER_TIER_PRICE_TABLE_DISCLAIMER,
  textLooksLikeSupplierAgeTierPriceTable,
} from '@/lib/promotion-copy-normalize'
import PasteBlocksReaderView from '@/app/components/detail/PasteBlocksReaderView'
import { parseOptionalPasteForPublicDisplay } from '@/lib/paste-block-display'
import { partitionVerygoodExcludedDisplay } from '@/lib/verygood/verygood-excluded-display-buckets'

type TabId = 'local' | 'included' | 'shopping' | 'hotel'

/** 통화·금액 토막만 진하게 (현지지불 블록용) */
function VerygoodExcludedCurrencyLine({ text }: { text: string }) {
  const re =
    /(\d{1,3}(?:,\d{3})+|\d{1,5})\s*(?:EUR|USD|GBP|유로|달러|€|\$|원\/인|원)|(?:EUR|USD|GBP)\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d{1,5})|\d+\s*유(?:로)?(?:\/인)?/gi
  const nodes: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  const rx = new RegExp(re.source, re.flags)
  while ((m = rx.exec(text)) !== null) {
    if (m.index > last)
      nodes.push(
        <Fragment key={`p-${last}-${m.index}`}>{text.slice(last, m.index)}</Fragment>
      )
    nodes.push(
      <strong key={`c-${m.index}`} className="font-extrabold text-teal-900 dark:text-teal-100">
        {m[0]}
      </strong>
    )
    last = rx.lastIndex
  }
  if (last < text.length) nodes.push(<Fragment key={`p-tail-${last}`}>{text.slice(last)}</Fragment>)
  return nodes.length > 0 ? <>{nodes}</> : text
}

type LegacyTour = {
  id: string
  name: string
  priceUsd: number
  duration: string
  waitPlaceIfNotJoined: string
  priceText?: string
  bookingType?: string
}

type Props = {
  /** 탭 기본값 리셋용 (상품 전환 시 부모에서 key로 재마운트 권장) */
  product: TravelProduct
  uiOptionalRows: UiOptionalTourRow[]
  optionalDisplayInput: PublicOptionalDisplayInput
  shoppingDisplayInput: PublicShoppingDisplayInput
  optionalToursForSheet: LegacyTour[]
  shoppingCount: number
  shoppingItems: string | null | undefined
  shoppingVisitCountTotal: number | null | undefined
  shoppingNoticeRaw: string | null | undefined
  shoppingStopsStructured: ShoppingStopRow[] | null | undefined
}

const TAB_STYLE =
  'min-h-[44px] flex-1 rounded-xl px-3 py-2.5 text-center text-xs font-bold transition sm:text-sm'

export default function VerygoodProductExtraInfoTabs({
  product,
  uiOptionalRows,
  optionalDisplayInput,
  shoppingDisplayInput,
  optionalToursForSheet,
  shoppingCount,
  shoppingItems,
  shoppingVisitCountTotal,
  shoppingNoticeRaw,
  shoppingStopsStructured,
}: Props) {
  const airtelHotel = useMemo(
    () => parseAirtelHotelInfoPublic(product.airtelHotelInfoJson ?? null),
    [product.airtelHotelInfoJson]
  )

  const includedExcludedSplit = useMemo(
    () => splitIncludedExcludedForPublicDisplay(product.includedText, product.excludedText),
    [product.includedText, product.excludedText]
  )

  const excludedMerged = useMemo(() => {
    const { excludedLines } = splitIncludedExcludedForPublicDisplay(product.includedText, product.excludedText)
    const baseExcluded = excludedLines.join('\n')
    const isModetour = normalizeSupplierOrigin(product.originSource) === 'modetour'
    if (isModetour) {
      return mergeModetourExcludedWithSingleRoomForPublicTab(
        baseExcluded,
        product.singleRoomSurchargeDisplayText ?? null,
        product.singleRoomSurchargeAmount ?? null,
        product.singleRoomSurchargeCurrency ?? null
      )
    }
    return mergeExcludedWithSingleRoomSurcharge(
      baseExcluded,
      product.singleRoomSurchargeDisplayText ?? null,
      product.singleRoomSurchargeAmount ?? null,
      product.singleRoomSurchargeCurrency ?? null
    )
  }, [
    product.includedText,
    product.excludedText,
    product.originSource,
    product.singleRoomSurchargeDisplayText,
    product.singleRoomSurchargeAmount,
    product.singleRoomSurchargeCurrency,
  ])

  const excludedDisplay = useMemo(
    () => formatPublicExcludedTextAfterMerge(excludedMerged),
    [excludedMerged]
  )

  const excludedBuckets = useMemo(
    () => partitionVerygoodExcludedDisplay(excludedDisplay),
    [excludedDisplay]
  )

  const optionalPasteTrim = product.optionalToursPasteRaw?.trim() ?? ''
  const optionalPasteBlocks = useMemo(
    () => parseOptionalPasteForPublicDisplay(optionalPasteTrim),
    [optionalPasteTrim]
  )
  const showLegacyOptionalSheet = shouldShowLegacyOptionalSheetForPublic(optionalDisplayInput)
  const showStructuredLocalOptionsForUi = shouldShowOptionalStructuredNoticeUi(optionalDisplayInput)
  const showOptionalPasteFallback = shouldShowOptionalPasteFallback(optionalDisplayInput)
  const hasLocalPanel = shouldShowPublicOptionalSection(optionalDisplayInput)
  const hasIncludedContent =
    includedExcludedSplit.includedLines.length > 0 ||
    includedExcludedSplit.includedFootnotes.length > 0 ||
    Boolean(excludedDisplay.trim())
  const hasShoppingPanel = shouldShowPublicShoppingSection(shoppingDisplayInput)
  const dayHotelPlans = product.dayHotelPlans ?? []
  const legacyHotelSummaryFallback = Boolean(product.hotelSummaryRaw?.trim())
  const hasHotelPanel =
    dayHotelPlans.length > 0 ||
    legacyHotelSummaryFallback ||
    airtelHotel != null ||
    Boolean(product.hotelNoticeRaw?.trim()) ||
    Boolean(product.hotelStatusText?.trim())

  const defaultTab = useMemo((): TabId => {
    if (hasLocalPanel) return 'local'
    if (hasIncludedContent) return 'included'
    if (hasShoppingPanel) return 'shopping'
    if (hasHotelPanel) return 'hotel'
    return 'included'
  }, [hasLocalPanel, hasIncludedContent, hasShoppingPanel, hasHotelPanel])

  const [tab, setTab] = useState<TabId>(defaultTab)
  /** DB에 남아 있는 옛 `hotelSummaryRaw`만 — 일차별 계획이 없을 때만 탭에 보조 표시 */
  const dedupedHotelSummaryLegacy = useMemo(() => {
    const raw = product.hotelSummaryRaw?.trim()
    if (!raw) return null
    const normalizedAirtelValues = new Set(
      Object.values(airtelHotel ?? {})
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean)
    )
    const lines = raw
      .replace(/\r/g, '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const uniq: string[] = []
    const seen = new Set<string>()
    for (const line of lines) {
      const key = line.replace(/\s+/g, ' ').toLowerCase()
      if (seen.has(key)) continue
      if (normalizedAirtelValues.has(key)) continue
      seen.add(key)
      uniq.push(line)
    }
    return uniq.length > 0 ? uniq.join('\n') : null
  }, [product.hotelSummaryRaw, airtelHotel])

  return (
    <section className="rounded-2xl border border-bt-border-strong bg-bt-surface p-4 shadow-sm sm:p-6">
      <h2 className="mb-3 border-l-4 border-bt-card-title pl-3 text-lg font-semibold text-bt-card-title">부가 정보</h2>
      <p className="bt-wrap mb-4 text-center text-xs text-bt-muted">
        현지옵션·포함/불포함·쇼핑·호텔을 탭으로 전환해 볼 수 있습니다.
      </p>

      <div className="flex flex-wrap gap-2 border-b border-bt-border-soft pb-3 sm:flex-nowrap">
        <button
          type="button"
          onClick={() => setTab('local')}
          className={`${TAB_STYLE} ${
            tab === 'local'
              ? 'bg-bt-brand-blue-strong text-white shadow-sm'
              : 'border border-bt-border-soft bg-bt-surface-alt text-bt-body hover:bg-bt-surface-soft'
          }`}
        >
          현지옵션
        </button>
        <button
          type="button"
          onClick={() => setTab('included')}
          className={`${TAB_STYLE} ${
            tab === 'included'
              ? 'bg-bt-brand-blue-strong text-white shadow-sm'
              : 'border border-bt-border-soft bg-bt-surface-alt text-bt-body hover:bg-bt-surface-soft'
          }`}
        >
          포함/불포함사항
        </button>
        <button
          type="button"
          onClick={() => setTab('shopping')}
          className={`${TAB_STYLE} ${
            tab === 'shopping'
              ? 'bg-bt-brand-blue-strong text-white shadow-sm'
              : 'border border-bt-border-soft bg-bt-surface-alt text-bt-body hover:bg-bt-surface-soft'
          }`}
        >
          쇼핑정보
        </button>
        <button
          type="button"
          onClick={() => setTab('hotel')}
          className={`${TAB_STYLE} ${
            tab === 'hotel'
              ? 'bg-bt-brand-blue-strong text-white shadow-sm'
              : 'border border-bt-border-soft bg-bt-surface-alt text-bt-body hover:bg-bt-surface-soft'
          }`}
        >
          호텔정보
        </button>
      </div>

      <div className="mt-5 min-h-[120px]">
        {tab === 'local' && (
          <div className="space-y-6">
            {showLegacyOptionalSheet ? (
              <OptionalToursFactSheet embedded tours={optionalToursForSheet} productType={product.productType} />
            ) : null}
            {showStructuredLocalOptionsForUi ? (
              <StructuredLocalOptionsSection
                embedded
                noticeRaw={product.optionalTourNoticeRaw ?? null}
                noticeItems={product.optionalTourNoticeItems ?? []}
                displayNoticeFinal={product.optionalTourDisplayNoticeFinal ?? null}
                rows={uiOptionalRows}
                productType={product.productType}
              />
            ) : null}
            {showOptionalPasteFallback ? (
              <PasteBlocksReaderView
                blocks={optionalPasteBlocks}
                sectionLabel="관리자 입력 · 현지옵션"
                accentClassName="text-bt-card-accent-strong"
              />
            ) : null}
            {!hasLocalPanel ? (
              <p className="text-center text-sm text-bt-meta">등록된 현지옵션 안내가 없습니다. 상담 시 문의해 주세요.</p>
            ) : null}
          </div>
        )}

        {tab === 'included' && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">포함</p>
              {product.includedText?.trim() ? (
                <div className="mt-3">
                  {textLooksLikeSupplierAgeTierPriceTable(product.includedText) ? (
                    <p className="bt-wrap mb-2 rounded border border-amber-200/80 bg-amber-50/90 p-2 text-left text-[11px] leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                      {SUPPLIER_TIER_PRICE_TABLE_DISCLAIMER}
                    </p>
                  ) : null}
                  {includedExcludedSplit.includedLines.length > 0 ? (
                    <ul className="bt-wrap list-none space-y-2 text-sm font-medium leading-relaxed text-bt-body">
                      {includedExcludedSplit.includedLines.map((line, i) => (
                        <li key={i} className="pl-0">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="bt-wrap text-sm text-bt-meta">등록된 포함 항목 라인이 없습니다.</p>
                  )}
                  {includedExcludedSplit.includedFootnotes.length > 0 ? (
                    <div className="bt-wrap mt-4 space-y-2 border-t border-bt-border-soft pt-3 text-xs leading-relaxed text-bt-muted">
                      {includedExcludedSplit.includedFootnotes.map((line, i) => (
                        <p key={i} className="whitespace-pre-wrap">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="bt-wrap mt-3 text-sm text-bt-meta">등록된 포함사항이 없습니다.</p>
              )}
            </div>
            <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-left">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">불포함</p>
              {excludedDisplay.trim() ? (
                <div className="mt-3 space-y-4">
                  {excludedBuckets.localPay.length > 0 ? (
                    <div className="rounded-xl border border-teal-200/90 bg-teal-50/90 p-3 dark:border-teal-900/50 dark:bg-teal-950/30">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-teal-900 dark:text-teal-100/95">
                        현지지불
                      </p>
                      <ul className="mt-2 list-none space-y-2 text-sm font-medium leading-relaxed text-teal-950 dark:text-teal-50/95">
                        {excludedBuckets.localPay.map((line, i) => (
                          <li key={`vg-lp-${i}`} className="whitespace-pre-wrap pl-0">
                            <VerygoodExcludedCurrencyLine text={line} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {excludedBuckets.addon.length > 0 ? (
                    <div className="rounded-xl border border-bt-border bg-bt-surface-soft p-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-bt-muted">추가비용</p>
                      <ul className="mt-2 list-none space-y-2 text-sm font-medium leading-relaxed text-bt-body">
                        {excludedBuckets.addon.map((line, i) => (
                          <li key={`vg-ad-${i}`} className="whitespace-pre-wrap pl-0">
                            {line}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {excludedBuckets.normal.length > 0 ? (
                    <ul className="bt-wrap list-none space-y-2 text-sm font-medium leading-relaxed text-bt-body">
                      {excludedBuckets.normal.map((line, i) => (
                        <li key={`vg-nm-${i}`} className="pl-0 whitespace-pre-wrap">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : (
                <p className="bt-wrap mt-3 text-sm text-bt-meta">등록된 불포함사항이 없습니다.</p>
              )}
            </div>
          </div>
        )}

        {tab === 'shopping' && (
          <div>
            {hasShoppingPanel ? (
              <ShoppingFactSheet
                embedded
                originSource={product.originSource ?? null}
                shoppingCount={shoppingCount}
                shoppingItems={shoppingItems ?? null}
                visitCountTotal={shoppingVisitCountTotal ?? null}
                shoppingNoticeRaw={shoppingNoticeRaw ?? null}
                shoppingPasteRaw={product.shoppingPasteRaw ?? null}
                structuredStops={shoppingStopsStructured ?? undefined}
              />
            ) : (
              <p className="bt-wrap text-center text-sm text-bt-meta">등록된 쇼핑 정보가 없습니다.</p>
            )}
          </div>
        )}

        {tab === 'hotel' && (
          <div className="space-y-4 text-sm">
            {dayHotelPlans.length > 0 ? (
              <div className="space-y-3">
                {dayHotelPlans.map((p) => {
                  const lines =
                    p.hotels?.length ? p.hotels : p.raw?.trim() ? [p.raw.trim()] : []
                  return (
                    <article
                      key={`${p.dayIndex}-${p.label}`}
                      className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-center"
                    >
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">{p.label}</p>
                      {lines.length > 0 ? (
                        <ul className="mt-3 list-none space-y-1.5">
                          {lines.map((line, idx) => (
                            <li key={idx} className="text-sm font-medium leading-relaxed text-bt-body">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            ) : null}
            {product.hotelNoticeRaw?.trim() ? (
              <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">유의·안내</p>
                <p className="bt-wrap mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-bt-body">
                  {product.hotelNoticeRaw.trim()}
                </p>
              </div>
            ) : null}
            {product.hotelStatusText?.trim() ? (
              <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">등급·상태</p>
                <p className="bt-wrap mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-bt-body">
                  {product.hotelStatusText.trim()}
                </p>
              </div>
            ) : null}
            {dayHotelPlans.length === 0 && dedupedHotelSummaryLegacy ? (
              <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">호텔 안내 (기존 저장)</p>
                <p className="bt-wrap mt-3 whitespace-pre-wrap text-sm font-medium leading-relaxed text-bt-body">
                  {dedupedHotelSummaryLegacy}
                </p>
              </div>
            ) : null}
            {airtelHotel && Object.keys(airtelHotel).length > 0 ? (
              <div className="rounded-xl border border-bt-border-soft bg-bt-surface-alt/80 p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-bt-card-accent-strong">호텔 상세 (에어텔)</p>
                <dl className="mt-3 space-y-3 text-center">
                  {Object.entries(airtelHotel).map(([k, v]) => (
                    <div key={k} className="border-b border-bt-border-soft pb-3 last:border-0 last:pb-0">
                      <dt className="text-[11px] font-semibold text-bt-muted">{k}</dt>
                      <dd className="mt-1 text-sm font-medium text-bt-body">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            {!dayHotelPlans.length &&
            !dedupedHotelSummaryLegacy &&
            !airtelHotel &&
            !product.hotelStatusText?.trim() &&
            !product.hotelNoticeRaw?.trim() ? (
              <p className="bt-wrap text-center text-sm text-bt-meta">등록된 호텔 정보가 없습니다. 상담 시 일정·등급을 안내드립니다.</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  )
}
