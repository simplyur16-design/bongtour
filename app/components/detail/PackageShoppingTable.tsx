'use client'

import type { ShoppingStopRow } from '@/lib/public-product-extras'

const CARD_CLASS = 'rounded-2xl border border-[#DAD4EE] bg-white px-4 py-4 sm:px-5'
const TABLE_HEAD = 'bg-[#EFEDF8] text-[11px] font-bold uppercase tracking-wide text-[#534AB7]'
const TABLE_CELL = 'px-3 py-2.5 text-sm text-[#1F1B2D] align-top'

type Props = {
  stops: ShoppingStopRow[] | null | undefined
  shoppingCount?: number | null
}

function stopLabel(stop: ShoppingStopRow, index: number): string {
  const visit = stop.visitNo ?? index + 1
  return String(visit)
}

function itemName(stop: ShoppingStopRow): string {
  const parts = [stop.itemType, stop.placeName, stop.shopName, stop.itemsText, stop.city]
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter(Boolean)
  return parts.join(' · ') || '—'
}

function costTime(stop: ShoppingStopRow): string {
  const dur = stop.durationText?.trim() || ''
  return dur || '—'
}

export default function PackageShoppingTable({ stops, shoppingCount }: Props) {
  const rows = (stops ?? []).filter(
    (s) => !s.candidateOnly && (s.itemType?.trim() || s.placeName?.trim() || s.shopName?.trim())
  )
  if (rows.length === 0) return null

  return (
    <section className={CARD_CLASS} aria-label="쇼핑">
      <h3 className="text-base font-bold text-[#1F1B2D]">
        쇼핑
        {shoppingCount != null && shoppingCount > 0 ? (
          <span className="ml-2 text-sm font-medium text-[#888780]">총 {shoppingCount}회</span>
        ) : null}
      </h3>
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
            {rows.map((stop, i) => (
              <tr key={`${stop.visitNo ?? i}-${stop.itemType ?? i}`} className="border-t border-[#DAD4EE]/60">
                <td className={`${TABLE_CELL} text-center tabular-nums font-semibold`}>
                  {stopLabel(stop, i)}
                </td>
                <td className={`${TABLE_CELL} font-medium bt-wrap`}>{itemName(stop)}</td>
                <td className={`${TABLE_CELL} bt-wrap text-[#534AB7]`}>{costTime(stop)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
