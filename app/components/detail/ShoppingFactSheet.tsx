'use client'

import { useMemo, useState } from 'react'
import {
  type ShoppingStopRow,
  shouldRenderShoppingFactSheetContent,
  shouldShowShoppingPasteFallback,
  shouldSuppressShoppingNoticeBecausePasteSame,
} from '@/lib/public-product-extras'
import { isShoppingItemsSummaryJunk, isShoppingPublicJunkRow } from '@/lib/shopping-public-row-filter'
import PasteBlocksReaderView from '@/app/components/detail/PasteBlocksReaderView'
import { parseShoppingPasteForPublicDisplay } from '@/lib/paste-block-display'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

type Props = {
  shoppingCount: number
  shoppingItems?: string | null
  /** rawMeta 등에서 온 총 방문 횟수 */
  visitCountTotal?: number | null
  shoppingNoticeRaw?: string | null
  /** structuredSignals.shoppingPasteRaw — 구조화 0행 시 입력란 원문 */
  shoppingPasteRaw?: string | null
  structuredStops?: ShoppingStopRow[]
  /** 부가정보 탭 내부: 접기 헤더·외곽 카드 없이 본문만 */
  embedded?: boolean
  /** 하나투어: 본문 `쇼핑 N회` SSOT 표·열 고정(행 수와 무관) */
  originSource?: string | null
}

export default function ShoppingFactSheet({
  shoppingCount,
  shoppingItems,
  visitCountTotal,
  shoppingNoticeRaw,
  shoppingPasteRaw,
  structuredStops,
  embedded = false,
  originSource = null,
}: Props) {
  const [open, setOpen] = useState(true)
  const [showAllRows, setShowAllRows] = useState(false)
  const [showAllItems, setShowAllItems] = useState(false)

  const cleanedStops = useMemo(
    () => (structuredStops ?? []).filter((r) => !isShoppingPublicJunkRow(r)),
    [structuredStops]
  )

  const effectiveCount =
    visitCountTotal != null && visitCountTotal >= 0 ? visitCountTotal : null
  const hasStructured = cleanedStops.length > 0
  const dbItemsJunk = isShoppingItemsSummaryJunk(shoppingItems ?? null)
  const shoppingDisplayInputForSheet = useMemo(
    () => ({
      structuredStopCount: cleanedStops.length,
      shoppingVisitCountTotal: visitCountTotal,
      shoppingCount,
      shoppingItems,
      shoppingNoticeRaw,
      shoppingPasteRaw,
    }),
    [
      cleanedStops.length,
      visitCountTotal,
      shoppingCount,
      shoppingItems,
      shoppingNoticeRaw,
      shoppingPasteRaw,
    ]
  )
  const showPasteFallback = shouldShowShoppingPasteFallback(shoppingDisplayInputForSheet)
  const showNoticeBlock =
    Boolean(String(shoppingNoticeRaw ?? '').trim()) &&
    !hasStructured &&
    !shouldSuppressShoppingNoticeBecausePasteSame(shoppingNoticeRaw, shoppingPasteRaw)
  const hasItems =
    shoppingItems != null &&
    shoppingItems.trim() !== '' &&
    !dbItemsJunk &&
    !hasStructured
  const hasInfo = shouldRenderShoppingFactSheetContent(shoppingDisplayInputForSheet, dbItemsJunk)
  if (!hasInfo) return null

  const pasteTrim = shoppingPasteRaw?.trim() ?? ''
  const shoppingPasteBlocks = useMemo(
    () => parseShoppingPasteForPublicDisplay(pasteTrim),
    [pasteTrim]
  )

  const countFromRows = cleanedStops.length
  const allCandidateStops =
    cleanedStops.length > 0 && cleanedStops.every((r) => r.candidateOnly === true)
  const isHanatourShoppingLayout = normalizeSupplierOrigin(originSource ?? '') === 'hanatour'
  const countLabel = (() => {
    const vcSsot = visitCountTotal != null && visitCountTotal >= 0 ? visitCountTotal : null
    if (hasStructured && countFromRows > 0) {
      if (isHanatourShoppingLayout) {
        if (vcSsot != null) return `쇼핑 ${vcSsot}회`
        return '쇼핑 안내'
      }
      if (allCandidateStops) {
        const n = vcSsot
        if (n != null && n > 0) return `쇼핑 ${n}회`
        return '쇼핑 후보 안내'
      }
      if (vcSsot != null) return `쇼핑 ${vcSsot}회`
      return '쇼핑 안내'
    }
    if (effectiveCount === 0 && !hasStructured && !showNoticeBlock && !hasItems && !showPasteFallback)
      return '노쇼핑'
    if (effectiveCount != null) return `쇼핑 ${effectiveCount}회`
    return '쇼핑 있음'
  })()

  const itemsList = hasStructured
    ? [
        ...new Set(
          cleanedStops.flatMap((r) => {
            const a = r.itemType.replace(/\s+/g, ' ').trim()
            const b = r.placeName.replace(/\s+/g, ' ').trim()
            if (a && b) return [`${a} (${b})`]
            return [a || b].filter(Boolean)
          })
        ),
      ]
    : shoppingItems?.trim()
      ? shoppingItems
          .split(/[,，、/]\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : []

  const SHOPPING_ITEMS_UI_INITIAL_ROWS = 5
  const SHOPPING_ITEMS_UI_MAX_ROWS = 15
  const visibleItems =
    showAllItems ? itemsList.slice(0, SHOPPING_ITEMS_UI_MAX_ROWS) : itemsList.slice(0, SHOPPING_ITEMS_UI_INITIAL_ROWS)

  const hasHanatourWideColumns =
    isHanatourShoppingLayout ||
    cleanedStops.some(
      (r) =>
        Boolean(String(r.city ?? '').trim()) ||
        Boolean(String(r.shopName ?? '').trim()) ||
        Boolean(String(r.itemsText ?? '').trim())
    )
  const structuredTable = hasStructured ? (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            {hasHanatourWideColumns ? (
              <>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">도시</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">쇼핑샵명(위치)</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">품목</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">소요시간</th>
              </>
            ) : (
              <>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">쇼핑품목</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">쇼핑장소</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">예상소요</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-700">환불</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {(showAllRows ? cleanedStops.slice(0, 15) : cleanedStops.slice(0, 5)).map((row, i) => (
            <tr key={`${row.raw.slice(0, 40)}_${i}`} className="border-b border-gray-100 align-top">
              {hasHanatourWideColumns ? (
                <>
                  <td className="px-2 py-2 text-gray-900">{String(row.city ?? '').trim() || '—'}</td>
                  <td className="px-2 py-2 text-gray-800">
                    {[row.shopName, row.shopLocation].filter((x) => String(x ?? '').trim()).join(' ') ||
                      row.placeName}
                  </td>
                  <td className="px-2 py-2 text-gray-800">
                    {String(row.itemsText ?? '').trim() || row.itemType}
                  </td>
                  <td className="px-2 py-2 text-gray-800">{row.durationText ?? '—'}</td>
                </>
              ) : (
                <>
                  <td className="px-2 py-2 text-gray-900">{row.itemType}</td>
                  <td className="px-2 py-2 text-gray-800">{row.placeName}</td>
                  <td className="px-2 py-2 text-gray-800">{row.durationText ?? '—'}</td>
                  <td className="px-2 py-2 text-gray-800">{row.refundPolicyText ?? '—'}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {cleanedStops.length > 5 ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowAllRows((v) => !v)}
            className="text-xs font-semibold text-bt-link hover:underline"
          >
            {showAllRows ? '쇼핑정보 접기' : `쇼핑정보 더보기 (${Math.min(cleanedStops.length, 15)}개 전체)`}
          </button>
        </div>
      ) : null}
    </div>
  ) : null

  /** 구조화 정류장이 있으면 표가 품목·장소 SSOT — 하단 요약 표에서 품목 줄을 다시 그리지 않는다 */
  const showItemsSummaryRow = itemsList.length > 0 && !hasStructured

  const body = (
    <>
      <p className={`text-xs text-gray-500 ${embedded ? 'text-center' : ''} ${embedded ? '' : 'mt-3'}`}>
        쇼핑 일정·환불 규정은 현지 및 공급사 운영에 따라 달라질 수 있습니다.
      </p>
      {hasStructured ? (
        <p className={`mt-3 text-center text-sm font-semibold text-bt-body ${embedded ? '' : ''}`}>{countLabel}</p>
      ) : null}
      {structuredTable}
      {showPasteFallback ? (
        <div className={hasStructured ? 'mt-4' : 'mt-3'}>
          <PasteBlocksReaderView
            blocks={shoppingPasteBlocks}
            sectionLabel="관리자 입력 · 쇼핑"
            accentClassName="text-slate-600"
          />
        </div>
      ) : null}
      {showNoticeBlock && (
        <p
          className={`whitespace-pre-wrap rounded border border-slate-100 bg-slate-50/80 p-3 text-sm text-gray-800 ${hasStructured ? 'mt-4' : 'mt-3'}`}
        >
          {shoppingNoticeRaw}
        </p>
      )}
      {!hasStructured ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700">구분</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700">내용</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2.5 text-gray-600">쇼핑 횟수</td>
                <td className="px-3 py-2.5 text-gray-800">{countLabel}</td>
              </tr>
              {showItemsSummaryRow && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2.5 text-gray-600">쇼핑 품목(요약)</td>
                  <td className="px-3 py-2.5 text-gray-800">
                    <ul className="list-inside list-disc space-y-0.5">
                      {visibleItems.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                    {itemsList.length > SHOPPING_ITEMS_UI_INITIAL_ROWS ? (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => setShowAllItems((v) => !v)}
                          className="text-xs font-semibold text-bt-link hover:underline"
                        >
                          {showAllItems
                            ? '쇼핑 품목 접기'
                            : `쇼핑 품목 더보기 (최대 ${SHOPPING_ITEMS_UI_MAX_ROWS}개)`}
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="text-bt-body [&_table]:text-bt-body [&_td]:text-bt-body [&_th]:text-bt-title">{body}</div>
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <h2 className="text-lg font-bold text-gray-900">쇼핑센터 안내</h2>
        <span className="shrink-0 text-sm font-medium text-bong-orange">{open ? '접기' : '보기'}</span>
      </button>
      {open && body}
    </section>
  )
}
