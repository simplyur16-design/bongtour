'use client'

import { useMemo, useState } from 'react'
import {
  shouldShowShoppingPasteFallback,
  shouldSuppressShoppingNoticeBecausePasteSame,
} from '@/lib/public-product-extras'
import { isShoppingItemsSummaryJunk } from '@/lib/shopping-public-row-filter'
import PasteBlocksReaderView from '@/app/components/detail/PasteBlocksReaderView'
import { parseShoppingPasteForPublicDisplay } from '@/lib/paste-block-display'
import {
  displayModetourShoppingItem,
  displayModetourShoppingPlace,
  groupModetourShoppingRowsForDisplay,
  hasModetourShoppingDisplayContent,
  resolveModetourShoppingTableRows,
  type ModetourShoppingTableInput,
} from '@/lib/modetour-shopping-table-display'

const CARD_CLASS = 'rounded-2xl border border-[#DAD4EE] bg-white px-4 py-4 sm:px-5'
const TABLE_HEAD = 'bg-[#EFEDF8] text-[11px] font-bold uppercase tracking-wide text-[#534AB7]'
const TABLE_CELL = 'px-3 py-2.5 text-sm text-[#1F1B2D] align-top'

const INITIAL_ROWS = 5
const MAX_ROWS = 15

type Props = ModetourShoppingTableInput & {
  shoppingCount?: number | null
  visitCountTotal?: number | null
  embedded?: boolean
}

export default function ModetourShoppingTable({
  stops,
  shoppingShopOptions,
  shoppingItems,
  shoppingPasteRaw,
  shoppingNoticeRaw,
  shoppingCount,
  visitCountTotal,
  embedded = false,
}: Props) {
  const [showAllRows, setShowAllRows] = useState(false)

  const tableInput = useMemo(
    () => ({ stops, shoppingShopOptions, shoppingItems, shoppingPasteRaw, shoppingNoticeRaw }),
    [stops, shoppingShopOptions, shoppingItems, shoppingPasteRaw, shoppingNoticeRaw]
  )

  const rows = useMemo(() => resolveModetourShoppingTableRows(tableInput), [tableInput])
  const grouped = useMemo(() => groupModetourShoppingRowsForDisplay(rows), [rows])
  const visibleGrouped = showAllRows ? grouped.slice(0, MAX_ROWS) : grouped.slice(0, INITIAL_ROWS)

  const pasteTrim = shoppingPasteRaw?.trim() ?? ''
  const shoppingPasteBlocks = useMemo(() => parseShoppingPasteForPublicDisplay(pasteTrim), [pasteTrim])
  const showPaste = rows.length === 0 && Boolean(pasteTrim)
  const itemsList = useMemo(() => {
    const raw = shoppingItems?.trim() ?? ''
    if (!raw || isShoppingItemsSummaryJunk(shoppingItems ?? null)) return []
    return raw
      .split(/[,，、/]\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
  }, [shoppingItems])
  const showItems = rows.length === 0 && !showPaste && itemsList.length > 0
  const noticeTrim = shoppingNoticeRaw?.trim() ?? ''
  const showNotice =
    Boolean(noticeTrim) &&
    rows.length === 0 &&
    !shouldSuppressShoppingNoticeBecausePasteSame(shoppingNoticeRaw, shoppingPasteRaw)

  const shoppingDisplayInputForPaste = useMemo(
    () => ({
      structuredStopCount: rows.length,
      shoppingVisitCountTotal: visitCountTotal,
      shoppingCount: shoppingCount ?? null,
      shoppingItems,
      shoppingNoticeRaw,
      shoppingPasteRaw,
    }),
    [rows.length, visitCountTotal, shoppingCount, shoppingItems, shoppingNoticeRaw, shoppingPasteRaw]
  )
  const showPasteFallback =
    rows.length === 0 && shouldShowShoppingPasteFallback(shoppingDisplayInputForPaste)

  if (!hasModetourShoppingDisplayContent(tableInput) && !showPasteFallback) return null

  const visitCount =
    visitCountTotal != null && visitCountTotal >= 0
      ? visitCountTotal
      : shoppingCount != null && shoppingCount >= 0
        ? shoppingCount
        : null
  const countLabel =
    visitCount != null && visitCount > 0 ? (
      <span className="ml-2 text-sm font-medium text-[#888780]">총 {visitCount}회</span>
    ) : null

  const mainTable =
    rows.length > 0 ? (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <thead>
              <tr className={TABLE_HEAD}>
                <th className="rounded-tl-lg px-3 py-2">쇼핑품목</th>
                <th className="px-3 py-2">쇼핑장소</th>
                <th className="px-3 py-2">예상소요시간</th>
                <th className="rounded-tr-lg px-3 py-2">환불여부</th>
              </tr>
            </thead>
            <tbody>
              {visibleGrouped.map((g, i) => (
                <tr
                  key={`${g.row.raw}_${i}`}
                  className={`border-t border-[#DAD4EE]/60 align-top ${
                    g.row.candidateOnly ? 'bg-[#EFEDF8]/45' : ''
                  }`}
                >
                  {g.isFirstInItemGroup ? (
                    <td className={`${TABLE_CELL} font-medium`} rowSpan={g.itemRowSpan}>
                      {displayModetourShoppingItem(g.row)}
                      {g.row.candidateOnly ? (
                        <span className="mt-1 block text-[10px] font-semibold text-[#d9a81e]">후보</span>
                      ) : null}
                    </td>
                  ) : null}
                  <td className={TABLE_CELL}>{displayModetourShoppingPlace(g.row)}</td>
                  <td className={TABLE_CELL}>{g.row.durationText?.trim() || '—'}</td>
                  <td className={TABLE_CELL}>{g.row.refundPolicyText?.trim() || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {grouped.length > INITIAL_ROWS ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAllRows((v) => !v)}
              className="text-xs font-semibold text-[#534AB7] hover:underline"
            >
              {showAllRows
                ? '쇼핑정보 접기'
                : `쇼핑정보 더보기 (전체 ${Math.min(grouped.length, MAX_ROWS)}개)`}
            </button>
          </div>
        ) : null}
      </>
    ) : null

  const body = (
    <>
      {embedded ? (
        <p className="text-center text-xs text-gray-500">
          쇼핑 일정·환불 규정은 현지 및 공급사 운영에 따라 달라질 수 있습니다.
        </p>
      ) : null}
      {mainTable}
      {showPaste || showPasteFallback ? (
        <div className={rows.length > 0 ? 'mt-4' : embedded ? 'mt-3' : 'mt-3'}>
          <PasteBlocksReaderView
            blocks={shoppingPasteBlocks}
            sectionLabel={embedded ? '관리자 입력 · 쇼핑' : '쇼핑 안내'}
            accentClassName={embedded ? 'text-slate-600' : 'text-[#534AB7]'}
          />
        </div>
      ) : null}
      {showItems ? (
        <ul className={`space-y-1.5 text-sm text-[#1F1B2D] ${rows.length > 0 || showPaste ? 'mt-4' : 'mt-3'}`}>
          {itemsList.map((item, i) => (
            <li key={i} className="bt-wrap">
              <span className="mr-2 font-semibold tabular-nums text-[#534AB7]">{i + 1}.</span>
              {item}
            </li>
          ))}
        </ul>
      ) : null}
      {showNotice ? (
        <p className="mt-3 whitespace-pre-wrap rounded-xl border border-[#DAD4EE]/60 bg-[#FAFAFC] p-3 text-sm text-[#1F1B2D] bt-wrap">
          {noticeTrim}
        </p>
      ) : null}
    </>
  )

  if (embedded) {
    return <div className="text-bt-body [&_table]:text-bt-body [&_td]:text-bt-body [&_th]:text-bt-title">{body}</div>
  }

  return (
    <section className={CARD_CLASS} aria-label="쇼핑">
      <h3 className="text-base font-bold text-[#1F1B2D]">
        쇼핑
        {countLabel}
      </h3>
      <div className="mt-3">{body}</div>
    </section>
  )
}
