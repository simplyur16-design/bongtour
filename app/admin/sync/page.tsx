'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ParsedProductForDB, ParsedProductPrice, ParsedItinerary } from '@/lib/parsed-product-types'

const ORIGIN_SOURCES = [
  { value: '하나투어', label: '하나투어' },
  { value: '모두투어', label: '모두투어' },
  { value: '직접입력', label: '직접입력' },
]

const STATUS_OPTIONS = ['출발확정', '예약가능', '대기예약', '마감'] as const

const emptyParsed: ParsedProductForDB = {
  originSource: '하나투어',
  originCode: '',
  title: '',
  destination: '',
  duration: '',
  airline: '',
  prices: [],
  surcharges: [],
  itineraries: [],
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export default function AdminSyncPage() {
  const [originSource, setOriginSource] = useState('하나투어')
  const [originCode, setOriginCode] = useState('')
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveResult, setSaveResult] = useState<{ detailPath: string; message: string } | null>(null)
  const [form, setForm] = useState<ParsedProductForDB>(emptyParsed)
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [savedProducts, setSavedProducts] = useState<{ id: number; originCode: string; title: string }[]>([])

  useEffect(() => {
    fetch('/api/admin/products/v2')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSavedProducts(data)
      })
      .catch(() => {})
  }, [saveResult])

  const [y, m] = useMemo(() => selectedMonth.split('-').map(Number), [selectedMonth])
  const daysInMonth = getDaysInMonth(y, m)
  const priceByDate = useMemo(() => {
    const map: Record<string, ParsedProductPrice> = {}
    form.prices.forEach((p) => {
      map[p.date] = p
    })
    return map
  }, [form.prices])

  const runParse = useCallback(async () => {
    if (!rawText.trim()) {
      setError('텍스트를 붙여넣으세요.')
      return
    }
    setError('')
    setSaveResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/parse-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, originSource }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '파싱 실패')
      const parsed = data.parsed as ParsedProductForDB
      setForm(parsed)
      setOriginCode(parsed.originCode || '')
      if (parsed.prices?.length && parsed.prices[0].date) {
        const [yr, mo] = parsed.prices[0].date.split('-').map(Number)
        setSelectedMonth(`${yr}-${String(mo).padStart(2, '0')}`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '파싱 실패')
    } finally {
      setLoading(false)
    }
  }, [rawText, originSource])

  const saveToDb = useCallback(async () => {
    const payload: ParsedProductForDB = {
      ...form,
      originSource,
      originCode: originCode.trim() || form.originCode,
    }
    if (!payload.originCode || !payload.title?.trim() || !payload.destination?.trim()) {
      setError('원본 상품코드, 상품명, 여행지를 입력하세요.')
      return
    }
    setError('')
    setSaveResult(null)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/products/v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setSaveResult({ detailPath: data.detailPath ?? '/admin/sync', message: data.message ?? '저장되었습니다.' })
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }, [form, originSource, originCode])

  function getOrCreatePrice(dateStr: string): ParsedProductPrice {
    return (
      priceByDate[dateStr] ?? {
        date: dateStr,
        adultBase: 0,
        adultFuel: 0,
        childFuel: 0,
        infantFuel: 0,
        status: '예약가능',
        availableSeats: 0,
      }
    )
  }

  function updatePrice(dateStr: string, patch: Partial<ParsedProductPrice>) {
    setForm((f) => {
      const idx = f.prices.findIndex((p) => p.date === dateStr)
      const next = { ...getOrCreatePrice(dateStr), ...patch }
      const nextPrices = [...f.prices]
      if (idx >= 0) nextPrices[idx] = next
      else nextPrices.push(next)
      nextPrices.sort((a, b) => a.date.localeCompare(b.date))
      return { ...f, prices: nextPrices }
    })
  }

  function updateItinerary(index: number, field: keyof ParsedItinerary, value: number | string) {
    setForm((f) => ({
      ...f,
      itineraries: f.itineraries.map((i, idx) => (idx === index ? { ...i, [field]: value } : i)),
    }))
  }
  function addItinerary() {
    setForm((f) => ({
      ...f,
      itineraries: [...f.itineraries, { day: f.itineraries.length + 1, description: '' }],
    }))
  }
  function removeItinerary(index: number) {
    setForm((f) => ({ ...f, itineraries: f.itineraries.filter((_, i) => i !== index) }))
  }

  const monthLabel = `${y}년 ${m}월`

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">Bong투어 · 실시간 동기화</h1>
        <div className="flex items-center gap-3">
          <a href="/admin/travel-dashboard" className="text-sm text-gray-500 hover:text-gray-900">
            파싱 대시보드
          </a>
          <a href="/admin/products" className="text-sm text-gray-500 hover:text-gray-900">
            저장된 상품
          </a>
          <button
            type="button"
            onClick={saveToDb}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {saving ? '저장 중…' : 'DB 저장'}
          </button>
        </div>
      </header>

      {/* 상단: 여행사 선택 + 원본 상품코드 */}
      <div className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">여행사</label>
          <select
            value={originSource}
            onChange={(e) => setOriginSource(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {ORIGIN_SOURCES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {savedProducts.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">저장된 상품:</span>
              {savedProducts.slice(0, 5).map((p) => (
                <span key={p.id} className="inline-flex items-center rounded bg-gray-100 px-2 py-1 text-xs">
                  {p.originCode}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">원본 상품코드</label>
          <input
            value={originCode}
            onChange={(e) => setOriginCode(e.target.value)}
            placeholder="파싱 후 자동 채움"
            className="w-48 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        {error && (
          <div className="border-l-4 border-[#0f172a] bg-white py-2 pl-3 text-sm text-[#0f172a]">{error}</div>
        )}
        {saveResult && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {saveResult.message}{' '}
            <a href={saveResult.detailPath} className="font-medium underline">
              보기
            </a>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* 메인: 전체 펼침 달력 (엑셀 그리드) */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden border-r border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (m === 1) setSelectedMonth(`${y - 1}-12`)
                    else setSelectedMonth(`${y}-${String(m - 1).padStart(2, '0')}`)
                  }}
                  className="rounded border border-gray-300 p-1.5 hover:bg-gray-100"
                >
                  ←
                </button>
                <span className="min-w-[120px] text-center font-medium">{monthLabel}</span>
                <button
                  type="button"
                  onClick={() => {
                    if (m === 12) setSelectedMonth(`${y + 1}-01`)
                    else setSelectedMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
                  }}
                  className="rounded border border-gray-300 p-1.5 hover:bg-gray-100"
                >
                  →
                </button>
              </div>
              <p className="text-xs text-gray-500">
                한 화면에 한 달치. 셀 직접 수정 가능. 기본가+유류=최종가 자동 계산.
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-800">상품 정보</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div>
                    <label className="text-xs text-gray-500">상품명</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">여행지</label>
                    <input
                      value={form.destination}
                      onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">일정</label>
                    <input
                      value={form.duration}
                      onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
                      placeholder="3박4일"
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">항공사</label>
                    <input
                      value={form.airline ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-800">가격 캘린더 (30일치)</h2>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="sticky left-0 z-10 w-24 border-b border-r border-gray-200 px-2 py-2 text-left font-medium">
                          날짜
                        </th>
                        <th className="w-22 border-b border-r border-gray-200 px-2 py-2 font-medium">상태</th>
                        <th className="w-14 border-b border-r border-gray-200 px-2 py-2 font-medium">좌석</th>
                        <th colSpan={3} className="border-b border-r border-gray-200 px-2 py-2 font-medium text-amber-800">
                          성인 (기본/유류/합계)
                        </th>
                        <th colSpan={3} className="border-b border-r border-gray-200 px-2 py-2 font-medium text-blue-800">
                          아동베드
                        </th>
                        <th colSpan={3} className="border-b border-r border-gray-200 px-2 py-2 font-medium text-emerald-800">
                          노베드
                        </th>
                        <th colSpan={3} className="border-b border-r border-gray-200 px-2 py-2 font-medium text-purple-800">
                          유아
                        </th>
                        <th className="w-20 border-b border-r border-gray-200 px-2 py-2 font-medium">가이드비</th>
                        <th className="w-20 border-b border-gray-200 px-2 py-2 font-medium">싱글</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dateStr = formatDateKey(y, m, day)
                        const row = getOrCreatePrice(dateStr)
                        const adultTotal = (row.adultBase ?? 0) + (row.adultFuel ?? 0)
                        const childBase = row.childBedBase ?? row.adultBase ?? 0
                        const childFuel = row.childFuel ?? 0
                        const childTotal = childBase + childFuel
                        const noBedBase = row.childNoBedBase ?? 0
                        const noBedTotal = noBedBase + childFuel
                        const infantBase = row.infantBase ?? 0
                        const infantTotal = infantBase + (row.infantFuel ?? 0)
                        return (
                          <tr key={dateStr} className="border-b border-gray-100 hover:bg-gray-50/50">
                            <td className="sticky left-0 z-10 border-r border-gray-100 bg-white px-2 py-1 font-medium">
                              {dateStr}
                            </td>
                            <td className="border-r border-gray-100">
                              <select
                                value={row.status}
                                onChange={(e) => updatePrice(dateStr, { status: e.target.value as typeof row.status })}
                                className="w-full rounded border border-gray-200 bg-white px-1 py-0.5 text-xs"
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>{s}</option>
                                ))}
                              </select>
                            </td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                min={0}
                                value={row.availableSeats ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, {
                                    availableSeats: e.target.value === '' ? 0 : parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.adultBase ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, { adultBase: parseInt(e.target.value, 10) || 0 })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.adultFuel ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, { adultFuel: parseInt(e.target.value, 10) || 0 })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100 font-medium">{adultTotal.toLocaleString()}</td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.childBedBase ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, {
                                    childBedBase: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.childFuel ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, { childFuel: parseInt(e.target.value, 10) || 0 })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100 font-medium">{childTotal.toLocaleString()}</td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.childNoBedBase ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, {
                                    childNoBedBase: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100" />
                            <td className="border-r border-gray-100 font-medium">{noBedTotal.toLocaleString()}</td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.infantBase ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, {
                                    infantBase: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100">
                              <input
                                type="number"
                                value={row.infantFuel ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, { infantFuel: parseInt(e.target.value, 10) || 0 })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-gray-100 font-medium">{infantTotal.toLocaleString()}</td>
                            <td className="border-r border-gray-100">
                              <input
                                value={row.localGuideFee ?? ''}
                                onChange={(e) => updatePrice(dateStr, { localGuideFee: e.target.value })}
                                placeholder="30 USD"
                                className="w-full rounded border border-gray-200 px-1 py-0.5"
                              />
                            </td>
                            <td className="border-gray-100">
                              <input
                                type="number"
                                value={row.singleRoomExtra ?? ''}
                                onChange={(e) =>
                                  updatePrice(dateStr, {
                                    singleRoomExtra: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
                                  })
                                }
                                className="w-full rounded border border-gray-200 px-1 py-0.5 text-right"
                              />
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-800">일정표</h2>
                <div className="space-y-2">
                  {form.itineraries.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={item.day}
                        onChange={(e) => updateItinerary(i, 'day', parseInt(e.target.value, 10) || 1)}
                        className="w-14 rounded border border-gray-200 px-2 py-1 text-sm"
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) => updateItinerary(i, 'description', e.target.value)}
                        placeholder="일정 설명"
                        rows={2}
                        className="flex-1 rounded border border-gray-200 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeItinerary(i)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addItinerary}
                    className="rounded border border-dashed border-gray-300 px-2 py-1 text-sm text-gray-500 hover:bg-gray-50"
                  >
                    + 일정 추가
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* 우측 사이드바: Raw Data 주입 */}
        <aside className="flex w-full flex-col border-t border-gray-200 bg-white lg:w-[380px] lg:border-l">
          <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-800">Raw Data 주입</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              하나투어/모두투어 상세페이지 텍스트를 붙여넣으면 AI 파싱이 실행되어 캘린더에 자동 반영됩니다.
            </p>
          </div>
          <div className="flex flex-1 flex-col min-h-0 p-4">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="상세페이지에서 복사한 텍스트를 붙여넣은 뒤 [AI 파싱 실행] 버튼을 누르세요."
              className="min-h-[200px] flex-1 resize-none rounded-lg border border-gray-300 p-3 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
              rows={14}
            />
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={runParse}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {loading ? 'AI 파싱 중…' : 'AI 파싱 실행'}
              </button>
              <p className="text-xs text-gray-500">
                [Parsing Rules] 성인/아동/노베드/유아 분리, 기본가+유류=최종가, 인원별 할증, 현지 가이드비·싱글룸 추출
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
