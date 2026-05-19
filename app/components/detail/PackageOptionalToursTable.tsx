'use client'

import { useMemo, useState } from 'react'
import PasteBlocksReaderView from '@/app/components/detail/PasteBlocksReaderView'
import { parseOptionalPasteForPublicDisplay } from '@/lib/paste-block-display'
import { getPackageOptionalTourRowsFromProduct } from '@/lib/optional-tours-ui-model'
import { OPTIONAL_TOUR_UI_INITIAL_ROWS, OPTIONAL_TOUR_UI_MAX_ROWS } from '@/lib/optional-tour-limits'

const CARD_CLASS = 'rounded-2xl border border-[#DAD4EE] bg-white px-4 py-4 sm:px-5'
const TABLE_HEAD = 'bg-[#EFEDF8] text-[11px] font-bold uppercase tracking-wide text-[#534AB7]'
const TABLE_CELL = 'px-3 py-2.5 text-sm text-[#1F1B2D] align-top'

type Props = {
  optionalToursStructured?: string | null
  optionalToursPasteRaw?: string | null
}

function formatCostTime(
  row: {
    priceDisplay: string
    durationText: string | null
    adultPrice: number | null
    currency: string | null
    includedNoExtraCharge?: boolean
  },
  tourName: string
): string {
  const nameNorm = tourName.replace(/\s+/g, ' ').trim()
  let price =
    row.priceDisplay?.trim() ||
    (row.adultPrice != null && row.adultPrice > 0
      ? `${row.currency ?? '₩'}${row.adultPrice.toLocaleString('ko-KR')}`
      : '')
  if (price && (price === nameNorm || (/^소요시간/i.test(price) && !row.adultPrice))) {
    price = row.includedNoExtraCharge ? '포함' : ''
  }
  const dur = row.durationText?.trim() || ''
  if (price && dur) return `${price} · ${dur}`
  if (price) return price
  if (dur) return dur
  return row.includedNoExtraCharge ? '포함' : '상담 시 안내'
}

export default function PackageOptionalToursTable({
  optionalToursStructured,
  optionalToursPasteRaw,
}: Props) {
  const [showAllRows, setShowAllRows] = useState(false)
  const rows = useMemo(
    () => getPackageOptionalTourRowsFromProduct(optionalToursStructured, optionalToursPasteRaw),
    [optionalToursStructured, optionalToursPasteRaw]
  )
  const visibleRows = showAllRows ? rows.slice(0, OPTIONAL_TOUR_UI_MAX_ROWS) : rows.slice(0, OPTIONAL_TOUR_UI_INITIAL_ROWS)

  const pasteTrim = optionalToursPasteRaw?.trim() ?? ''
  const optionalPasteBlocks = useMemo(
    () => parseOptionalPasteForPublicDisplay(pasteTrim),
    [pasteTrim]
  )
  const showPasteOnly = rows.length === 0 && Boolean(pasteTrim)

  if (rows.length === 0 && !showPasteOnly) return null

  return (
    <section className={CARD_CLASS} aria-label="옵션관광">
      <h3 className="text-base font-bold text-[#1F1B2D]">옵션관광</h3>
      {rows.length > 0 ? (
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[320px] border-collapse text-left">
          <thead>
            <tr className={TABLE_HEAD}>
              <th className="rounded-tl-lg px-3 py-2 w-14 text-center">회차</th>
              <th className="px-3 py-2">항목명</th>
              <th className="rounded-tr-lg px-3 py-2 w-[40%]">비용·시간</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => (
              <tr key={row.id} className="border-t border-[#DAD4EE]/60">
                <td className={`${TABLE_CELL} text-center tabular-nums font-semibold`}>{i + 1}</td>
                <td className={`${TABLE_CELL} font-medium bt-wrap`}>{row.name}</td>
                <td className={`${TABLE_CELL} bt-wrap text-[#534AB7] font-semibold tabular-nums`}>
                  {formatCostTime(row, row.name)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > OPTIONAL_TOUR_UI_INITIAL_ROWS ? (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowAllRows((v) => !v)}
              className="text-xs font-semibold text-[#534AB7] hover:underline"
            >
              {showAllRows
                ? '옵션관광 접기'
                : `옵션관광 더보기 (전체 ${Math.min(rows.length, OPTIONAL_TOUR_UI_MAX_ROWS)}개)`}
            </button>
          </div>
        ) : null}
      </div>
      ) : (
        <div className="mt-3">
          <PasteBlocksReaderView
            blocks={optionalPasteBlocks}
            sectionLabel="옵션관광 안내"
            accentClassName="text-[#534AB7]"
          />
        </div>
      )}
    </section>
  )
}
