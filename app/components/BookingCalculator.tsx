'use client'

import { useState, useMemo } from 'react'
import {
  computeKRWQuotation,
  computeLocalFeeTotal,
} from '@/lib/price-utils'

type PriceRow = {
  date: string
  adultBase?: number
  adultFuel?: number
  childBedBase?: number | null
  childNoBedBase?: number | null
  childFuel?: number
  infantBase?: number | null
  infantFuel?: number
  priceAdult?: number
  priceChildWithBed?: number | null
  priceChildNoBed?: number | null
  priceInfant?: number | null
}

type Props = {
  prices: PriceRow[]
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
}

export default function BookingCalculator({
  prices,
  mandatoryLocalFee,
  mandatoryCurrency,
}: Props) {
  const [selectedDateIndex, setSelectedDateIndex] = useState(0)
  const [adult, setAdult] = useState(0)
  const [childBed, setChildBed] = useState(0)
  const [childNoBed, setChildNoBed] = useState(0)
  const [infant, setInfant] = useState(0)

  const priceRow = prices[selectedDateIndex] ?? null

  const { total: krwTotal } = useMemo(() => {
    if (!priceRow) return { total: 0 }
    const pax = { adult, childBed, childNoBed, infant }
    return computeKRWQuotation(priceRow, pax)
  }, [priceRow, adult, childBed, childNoBed, infant])

  const localFeeTotal = useMemo(
    () =>
      computeLocalFeeTotal(mandatoryLocalFee, {
        adult,
        childBed,
        childNoBed,
      }),
    [mandatoryLocalFee, adult, childBed, childNoBed]
  )

  if (!prices.length) {
    return (
      <div className="border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
        가격 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="border border-gray-200 bg-white p-5">
      <h2 className="border-l-4 border-[#0f172a] pl-3 text-sm font-semibold text-[#0f172a]">상담 계산기</h2>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">출발일</label>
          <select
            value={selectedDateIndex}
            onChange={(e) => setSelectedDateIndex(parseInt(e.target.value, 10))}
            className="w-full border border-gray-300 px-3 py-2 text-sm"
          >
            {prices.map((p, i) => (
              <option key={p.date} value={i}>
                {p.date}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">성인</label>
            <input
              type="number"
              min={0}
              value={adult || ''}
              onChange={(e) => setAdult(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">아동(베드)</label>
            <input
              type="number"
              min={0}
              value={childBed || ''}
              onChange={(e) => setChildBed(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">아동(노베드)</label>
            <input
              type="number"
              min={0}
              value={childNoBed || ''}
              onChange={(e) => setChildNoBed(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">유아</label>
            <input
              type="number"
              min={0}
              value={infant || ''}
              onChange={(e) => setInfant(parseInt(e.target.value, 10) || 0)}
              className="w-full border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">원화 총계</span>
            <span className="font-semibold text-gray-900">{krwTotal.toLocaleString()}원</span>
          </div>
          {localFeeTotal != null && mandatoryCurrency && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">현지 지불 외화 총계</span>
              <span className="font-semibold text-amber-800">
                {mandatoryCurrency} {localFeeTotal.toLocaleString()}
              </span>
            </div>
          )}
          <p className="text-xs text-gray-500">
            한국 결제액과 현지 지불액은 합산하지 않고 병기합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
