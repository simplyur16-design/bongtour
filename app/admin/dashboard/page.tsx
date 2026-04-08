'use client'

import { useState, useMemo, Fragment, useEffect } from 'react'
import type {
  ExtractedProduct,
  ExtractedOptionalTour,
  ExtractedItineraryDay,
  ExtractedDailyScheduleItem,
  ExtractedPricingByAge,
  ExtractedPriceTier,
  ExtractedGroupModifier,
} from '@/lib/extraction-schema'

const emptyProduct: ExtractedProduct = {
  productName: '',
  airline: '',
  productCode: '',
  groupNumber: '',
  dailyPrices: [],
  shoppingCount: 0,
  optionalTours: [],
  itinerary: [],
}

const STATUS_OPTIONS = ['출발확정', '예약가능', '대기예약', '마감'] as const

function defaultTier(): ExtractedPriceTier {
  return { base: 0, fuel: 0, total: 0 }
}

function defaultPricing(): ExtractedPricingByAge {
  return { adult: defaultTier() }
}

function defaultScheduleItem(dateStr: string): ExtractedDailyScheduleItem {
  return {
    date: dateStr,
    status: '예약가능',
    pricing: defaultPricing(),
  }
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function formatDateKey(year: number, month: number, day: number): string {
  const d = String(day).padStart(2, '0')
  const m = String(month).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function computeTotal(t: ExtractedPriceTier): number {
  if (t.total !== undefined && t.total !== 0) return t.total
  return (t.base || 0) + (t.fuel || 0)
}

export default function AdminDashboardPage() {
  const [rawText, setRawText] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveResult, setSaveResult] = useState<{ detailPath: string; message: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'product' | 'calendar' | 'itinerary'>('product')
  const [form, setForm] = useState<ExtractedProduct>(emptyProduct)
  const [organizerName, setOrganizerName] = useState('하나투어')
  const [selectedBrandKey, setSelectedBrandKey] = useState('hanatour')
  const [brands, setBrands] = useState<{ brandKey: string; displayName: string }[]>([
    { brandKey: 'hanatour', displayName: '하나투어' },
    { brandKey: 'modetour', displayName: '모두투어' },
    { brandKey: 'ybtour', displayName: '노랑풍선' },
    { brandKey: 'verygoodtour', displayName: '참좋은여행사' },
    { brandKey: 'gyowontour', displayName: '교원투어' },
    { brandKey: 'other', displayName: '기타' },
  ])
  const [primaryDestination, setPrimaryDestination] = useState('')
  const [productCodePricing, setProductCodePricing] = useState('')
  const [dailySchedule, setDailySchedule] = useState<ExtractedDailyScheduleItem[]>([])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const [year, month] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    return [y, m]
  }, [selectedMonth])
  const daysInMonth = getDaysInMonth(year, month)
  const scheduleByDate = useMemo(() => {
    const map: Record<string, ExtractedDailyScheduleItem> = {}
    dailySchedule.forEach((row) => {
      if (row.date) map[row.date] = row
    })
    return map
  }, [dailySchedule])

  const [editingModifiers, setEditingModifiers] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/brands')
      .then((r) => r.json())
      .then((list: { brandKey: string; displayName: string }[]) => {
        if (Array.isArray(list) && list.length > 0) setBrands(list)
      })
      .catch(() => {})
  }, [])

  async function handleExtract() {
    if (!rawText.trim()) {
      setError('텍스트를 붙여넣으세요.')
      return
    }
    setError('')
    setSaveResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '추출 실패')
      const product = data.product ?? data
      const pricing = data.pricing ?? null

      setForm(product)
      setOrganizerName(product.brandName ?? '')
      setPrimaryDestination(product.primaryDestination ?? '')

      if (pricing?.product_code) {
        setProductCodePricing(pricing.product_code)
        const schedule = pricing.daily_schedule ?? []
        setDailySchedule(schedule.length ? schedule : [])
        if (schedule.length > 0 && schedule[0].date) {
          const first = schedule[0].date
          const [y, m] = first.split('-').map(Number)
          setSelectedMonth(`${y}-${String(m).padStart(2, '0')}`)
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '추출 실패')
    } finally {
      setLoading(false)
    }
  }

  function getOrCreateRow(dateStr: string): ExtractedDailyScheduleItem {
    return scheduleByDate[dateStr] ?? defaultScheduleItem(dateStr)
  }

  function updateCalendarRow(
    dateStr: string,
    field: keyof ExtractedDailyScheduleItem,
    value: unknown
  ) {
    setDailySchedule((prev) => {
      const idx = prev.findIndex((r) => r.date === dateStr)
      const next = { ...getOrCreateRow(dateStr), [field]: value }
      if (idx >= 0) {
        const copy = [...prev]
        copy[idx] = next
        return copy
      }
      return [...prev, next].sort((a, b) => a.date.localeCompare(b.date))
    })
  }

  function updatePricingTier(
    dateStr: string,
    age: keyof ExtractedPricingByAge,
    tierKey: keyof ExtractedPriceTier,
    value: number
  ) {
    const row = getOrCreateRow(dateStr)
    const pricing = { ...row.pricing }
    if (!pricing[age]) pricing[age] = defaultTier()
    const tier = { ...(pricing[age] as ExtractedPriceTier), [tierKey]: value }
    if (tierKey === 'base' || tierKey === 'fuel') {
      tier.total = tier.base + tier.fuel
    }
    pricing[age] = tier
    updateCalendarRow(dateStr, 'pricing', pricing)
  }

  function addCalendarRow() {
    const nextDate =
      dailySchedule.length > 0
        ? (() => {
            const last = dailySchedule[dailySchedule.length - 1].date
            const d = new Date(last)
            d.setDate(d.getDate() + 1)
            return d.toISOString().slice(0, 10)
          })()
        : `${selectedMonth}-01`
    setDailySchedule((prev) => [...prev, defaultScheduleItem(nextDate)])
  }

  function removeCalendarRow(dateStr: string) {
    setDailySchedule((prev) => prev.filter((r) => r.date !== dateStr))
  }

  function setModifiersForDate(dateStr: string, modifiers: ExtractedGroupModifier[]) {
    updateCalendarRow(dateStr, 'modifiers', modifiers)
  }

  async function handleSave() {
    if (!form.productName?.trim() || !form.productCode?.trim() || !form.groupNumber?.trim()) {
      setError('상품명, 상품코드, 단체번호를 입력하세요.')
      return
    }
    setError('')
    setSaveResult(null)
    setSaving(true)
    try {
      const dailyPrices = dailySchedule.map((row) => {
        const t = row.pricing?.adult ?? defaultTier()
        const total = computeTotal(t)
        return { date: row.date, price: String(total) }
      })
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          dailyPrices: dailyPrices.length ? dailyPrices : form.dailyPrices,
          organizerName: organizerName.trim() || undefined,
          primaryDestination: primaryDestination.trim() || undefined,
          ...(selectedBrandKey && { brandKey: selectedBrandKey }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setSaveResult({
        detailPath: data.detailPath ?? '/admin/products',
        message: data.message ?? '저장되었습니다.',
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  function updateOptionalTour(index: number, field: keyof ExtractedOptionalTour, value: string | number) {
    setForm((f) => ({
      ...f,
      optionalTours: f.optionalTours.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    }))
  }
  function addOptionalTour() {
    setForm((f) => ({
      ...f,
      optionalTours: [...f.optionalTours, { name: '', priceUsd: 0 }],
    }))
  }
  function removeOptionalTour(index: number) {
    setForm((f) => ({ ...f, optionalTours: f.optionalTours.filter((_, i) => i !== index) }))
  }
  function updateItinerary(
    index: number,
    field: keyof ExtractedItineraryDay,
    value: number | string | string[]
  ) {
    setForm((f) => ({
      ...f,
      itinerary: f.itinerary.map((d, i) => (i === index ? { ...d, [field]: value } : d)),
    }))
  }
  function addItinerary() {
    setForm((f) => ({
      ...f,
      itinerary: [...f.itinerary, { day: f.itinerary.length + 1, title: '', items: [] }],
    }))
  }
  function removeItinerary(index: number) {
    setForm((f) => ({ ...f, itinerary: f.itinerary.filter((_, i) => i !== index) }))
  }

  const monthLabel = `${year}년 ${month}월`

  return (
    <div className="flex h-screen flex-col bg-bt-surface-alt">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-bt-border-soft bg-bt-surface px-4 shadow-sm">
        <h1 className="text-lg font-bold text-bt-strong">상품 등록 대시보드</h1>
        <div className="flex items-center gap-3">
          <a
            href="/admin/register"
            className="text-sm text-bt-meta hover:text-bt-strong"
          >
            간편 등록
          </a>
          <a
            href="/admin/pending"
            className="text-sm text-bt-muted hover:text-bt-strong"
          >
            등록대기 목록
          </a>
          <a
            href="/admin/products"
            className="text-sm font-medium text-bt-muted hover:text-bt-strong"
          >
            상품 목록
          </a>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-bt-cta-primary px-4 py-2 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 flex-col lg:flex-row">
        {/* 좌측: 메인 폼 (탭) */}
        <div className="flex flex-1 flex-col min-h-0 border-r border-bt-border-soft bg-bt-surface lg:min-w-0">
          <div className="flex border-b border-bt-border-soft bg-bt-surface-soft/80">
            {[
              { id: 'product' as const, label: '상품정보' },
              { id: 'calendar' as const, label: '가격캘린더' },
              { id: 'itinerary' as const, label: '일정표' },
            ].map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === id
                    ? 'border-bt-brand-blue-strong text-bt-brand-blue-strong bg-bt-surface'
                    : 'border-transparent text-bt-muted hover:text-bt-strong'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'product' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-bt-meta">업체명</label>
                  <input
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-bt-meta">핵심 여행지</label>
                  <input
                    value={primaryDestination}
                    onChange={(e) => setPrimaryDestination(e.target.value)}
                    placeholder="예: 다낭, 방콕"
                    className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-bt-meta">상품명</label>
                  <input
                    value={form.productName}
                    onChange={(e) => setForm((f) => ({ ...f, productName: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-bt-meta">상품코드</label>
                    <input
                      value={form.productCode}
                      onChange={(e) => setForm((f) => ({ ...f, productCode: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-bt-meta">단체번호</label>
                    <input
                      value={form.groupNumber}
                      onChange={(e) => setForm((f) => ({ ...f, groupNumber: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-bt-meta">항공사</label>
                    <input
                      value={form.airline}
                      onChange={(e) => setForm((f) => ({ ...f, airline: e.target.value }))}
                      className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-bt-meta">쇼핑 횟수</label>
                    <input
                      type="number"
                      min={0}
                      value={form.shoppingCount}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, shoppingCount: parseInt(e.target.value, 10) || 0 }))
                      }
                      className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-bt-meta">가이드 경비 안내</label>
                  <input
                    value={form.guideFeeNote ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, guideFeeNote: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-bt-meta">쇼핑 품목</label>
                  <input
                    value={form.shoppingItems ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, shoppingItems: e.target.value }))}
                    className="mt-0.5 w-full rounded border border-bt-border-strong px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-bt-meta">현지옵션</label>
                    <button
                      type="button"
                      onClick={addOptionalTour}
                      className="flex items-center gap-1 text-xs text-bt-link hover:underline"
                    >
                      추가
                    </button>
                  </div>
                  <div className="mt-1 space-y-1">
                    {form.optionalTours.map((o, i) => (
                      <div key={i} className="flex gap-2">
                        <input
                          value={o.name}
                          onChange={(e) => updateOptionalTour(i, 'name', e.target.value)}
                          placeholder="명칭"
                          className="flex-1 rounded border border-bt-border-soft px-2 py-1 text-sm"
                        />
                        <input
                          type="number"
                          value={o.priceUsd || ''}
                          onChange={(e) =>
                            updateOptionalTour(i, 'priceUsd', parseInt(e.target.value, 10) || 0)
                          }
                          placeholder="USD"
                          className="w-20 rounded border border-bt-border-soft px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeOptionalTour(i)}
                          className="p-1 text-bt-subtle hover:text-bt-danger"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = selectedMonth.split('-').map(Number)
                        if (m === 1) setSelectedMonth(`${y - 1}-12`)
                        else setSelectedMonth(`${y}-${String(m - 1).padStart(2, '0')}`)
                      }}
                      className="rounded border border-bt-border-strong p-1.5 hover:bg-bt-surface-alt"
                    >
                      ←
                    </button>
                    <span className="min-w-[120px] text-center font-medium text-bt-strong">
                      {monthLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const [y, m] = selectedMonth.split('-').map(Number)
                        if (m === 12) setSelectedMonth(`${y + 1}-01`)
                        else setSelectedMonth(`${y}-${String(m + 1).padStart(2, '0')}`)
                      }}
                      className="rounded border border-bt-border-strong p-1.5 hover:bg-bt-surface-alt"
                    >
                      →
                    </button>
                  </div>
                  {productCodePricing && (
                    <span className="text-xs text-bt-meta">상품코드: {productCodePricing}</span>
                  )}
                  <button
                    type="button"
                    onClick={addCalendarRow}
                    className="flex items-center gap-1 rounded bg-bt-brand-blue-soft px-2 py-1.5 text-xs font-medium text-bt-link hover:bg-bt-brand-blue-soft/80"
                  >
                    행 추가
                  </button>
                </div>
                <p className="text-xs text-bt-meta">
                  본 이미지는 Auto-fill된 참고용입니다. 셀을 직접 수정할 수 있습니다.
                </p>
                <div className="overflow-x-auto rounded-lg border border-bt-border-soft">
                  <table className="w-full min-w-[900px] text-xs">
                    <thead>
                      <tr className="bg-bt-surface-alt">
                        <th className="sticky left-0 z-10 w-24 border-b border-r border-bt-border-soft px-2 py-2 text-left font-medium text-bt-body">
                          날짜
                        </th>
                        <th className="w-24 border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-body">
                          상태
                        </th>
                        <th className="w-14 border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-body">
                          좌석
                        </th>
                        <th colSpan={3} className="border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-warning">
                          성인 (기본/유류/합계)
                        </th>
                        <th colSpan={3} className="border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-brand-blue-strong">
                          아동 (기본/유류/합계)
                        </th>
                        <th colSpan={3} className="border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-badge-domestic-text">
                          노베드 (기본/유류/합계)
                        </th>
                        <th colSpan={3} className="border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-title">
                          유아 (기본/유류/합계)
                        </th>
                        <th className="w-32 border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-body">
                          인원별 추가금
                        </th>
                        <th className="w-20 border-b border-r border-bt-border-soft px-2 py-2 font-medium text-bt-body">
                          싱글
                        </th>
                        <th className="w-20 border-b border-bt-border-soft px-2 py-2 font-medium text-bt-body">
                          가이드비
                        </th>
                        <th className="w-8 border-b border-bt-border-soft" />
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dateStr = formatDateKey(year, month, day)
                        const row = getOrCreateRow(dateStr)
                        const pad = (n: number) => (n === 0 ? '' : n.toLocaleString())
                        const adult = row.pricing?.adult ?? defaultTier()
                        const childBed = row.pricing?.child_bed ?? defaultTier()
                        const childNobed = row.pricing?.child_nobed ?? defaultTier()
                        const infant = row.pricing?.infant ?? defaultTier()
                        const modStr =
                          row.modifiers?.length
                            ? row.modifiers
                                .map((m) => `${m.min_pax}인 ${m.extra >= 0 ? '+' : ''}${m.extra.toLocaleString()}`)
                                .join(', ')
                            : ''
                        return (
                          <tr key={dateStr} className="border-b border-bt-border-soft hover:bg-bt-surface-soft/50">
                            <td className="sticky left-0 z-10 border-r border-bt-border-soft bg-bt-surface px-2 py-1 font-medium">
                              {dateStr}
                            </td>
                            <td className="border-r border-bt-border-soft">
                              <select
                                value={row.status}
                                onChange={(e) =>
                                  updateCalendarRow(dateStr, 'status', e.target.value as typeof row.status)
                                }
                                className="w-full rounded border border-bt-border-soft bg-bt-surface px-1 py-0.5"
                              >
                                {STATUS_OPTIONS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="border-r border-bt-border-soft">
                              <input
                                type="number"
                                min={0}
                                value={row.seats ?? ''}
                                onChange={(e) =>
                                  updateCalendarRow(
                                    dateStr,
                                    'seats',
                                    e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                                  )
                                }
                                className="w-full rounded border border-bt-border-soft px-1 py-0.5 text-right"
                              />
                            </td>
                            {[
                              { age: 'adult' as const, tier: adult },
                              { age: 'child_bed' as const, tier: childBed },
                              { age: 'child_nobed' as const, tier: childNobed },
                              { age: 'infant' as const, tier: infant },
                            ].map(({ age, tier }) => (
                              <Fragment key={age}>
                                <td className="border-r border-bt-border-soft">
                                  <input
                                    type="number"
                                    value={tier.base || ''}
                                    onChange={(e) =>
                                      updatePricingTier(
                                        dateStr,
                                        age,
                                        'base',
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }
                                    className="w-full rounded border border-bt-border-soft px-1 py-0.5 text-right"
                                  />
                                </td>
                                <td className="border-r border-bt-border-soft">
                                  <input
                                    type="number"
                                    value={tier.fuel || ''}
                                    onChange={(e) =>
                                      updatePricingTier(
                                        dateStr,
                                        age,
                                        'fuel',
                                        parseInt(e.target.value, 10) || 0
                                      )
                                    }
                                    className="w-full rounded border border-bt-border-soft px-1 py-0.5 text-right"
                                  />
                                </td>
                                <td className="border-r border-bt-border-soft font-medium text-bt-strong">
                                  {pad(computeTotal(tier))}
                                </td>
                              </Fragment>
                            ))}
                            <td className="border-r border-bt-border-soft">
                              <input
                                value={editingModifiers[dateStr] ?? modStr ?? ''}
                                onFocus={() =>
                                  setEditingModifiers((prev) => ({
                                    ...prev,
                                    [dateStr]: modStr ?? '',
                                  }))
                                }
                                onChange={(e) =>
                                  setEditingModifiers((prev) => ({ ...prev, [dateStr]: e.target.value }))
                                }
                                onBlur={() => {
                                  const raw = (editingModifiers[dateStr] ?? modStr ?? '').trim()
                                  setEditingModifiers((prev) => {
                                    const next = { ...prev }
                                    delete next[dateStr]
                                    return next
                                  })
                                  if (!raw) {
                                    setModifiersForDate(dateStr, [])
                                    return
                                  }
                                  const parts = raw.split(/[,;]/).map((s) => s.trim())
                                  const mods: ExtractedGroupModifier[] = []
                                  parts.forEach((p) => {
                                    const match = p.match(/(\d+)인\s*([+-]?\d+)/)
                                    if (match)
                                      mods.push({
                                        min_pax: parseInt(match[1], 10),
                                        extra: parseInt(match[2], 10),
                                      })
                                  })
                                  setModifiersForDate(dateStr, mods)
                                }}
                                placeholder="4인 +250000, 7인 -100000"
                                className="w-full rounded border border-bt-border-soft px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-bt-border-soft">
                              <input
                                type="number"
                                value={row.single_room_extra ?? ''}
                                onChange={(e) =>
                                  updateCalendarRow(
                                    dateStr,
                                    'single_room_extra',
                                    e.target.value === '' ? undefined : parseInt(e.target.value, 10)
                                  )
                                }
                                className="w-full rounded border border-bt-border-soft px-1 py-0.5 text-right"
                              />
                            </td>
                            <td className="border-r border-bt-border-soft">
                              <input
                                value={row.local_guide_fee ?? ''}
                                onChange={(e) =>
                                  updateCalendarRow(dateStr, 'local_guide_fee', e.target.value)
                                }
                                placeholder="30 USD"
                                className="w-full rounded border border-bt-border-soft px-1 py-0.5"
                              />
                            </td>
                            <td className="bg-bt-surface">
                              <button
                                type="button"
                                onClick={() => removeCalendarRow(dateStr)}
                                className="p-1 text-bt-subtle hover:text-bt-danger"
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'itinerary' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-bt-body">일자별 일정</label>
                  <button
                    type="button"
                    onClick={addItinerary}
                    className="flex items-center gap-1 text-xs text-bt-link hover:underline"
                  >
                    행 추가
                  </button>
                </div>
                <div className="space-y-2">
                  {form.itinerary.map((d, i) => (
                    <div key={i} className="rounded-lg border border-bt-border-soft bg-bt-surface-soft/50 p-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={d.day}
                          onChange={(e) =>
                            updateItinerary(i, 'day', parseInt(e.target.value, 10) || 1)
                          }
                          className="w-14 rounded border border-bt-border-soft px-2 py-1 text-sm"
                        />
                        <input
                          value={d.title}
                          onChange={(e) => updateItinerary(i, 'title', e.target.value)}
                          placeholder="일정 제목"
                          className="flex-1 rounded border border-bt-border-soft px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => removeItinerary(i)}
                          className="p-1 text-bt-subtle hover:text-bt-danger"
                        >
                          삭제
                        </button>
                      </div>
                      <textarea
                        value={(d.items || []).join('\n')}
                        onChange={(e) =>
                          updateItinerary(i, 'items', e.target.value.split('\n').filter(Boolean))
                        }
                        placeholder="일정 내용 (한 줄씩)"
                        rows={2}
                        className="mt-2 w-full rounded border border-bt-border-soft px-2 py-1 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측: Raw Data 주입 */}
        <div className="flex w-full flex-col border-t border-bt-border-soft bg-bt-surface lg:w-[380px] lg:border-t-0 lg:border-l">
          <div className="border-b border-bt-border-soft bg-bt-surface-soft px-4 py-3">
            <h2 className="text-sm font-semibold text-bt-strong">Raw Data 주입</h2>
            <p className="mt-0.5 text-xs text-bt-meta">
              여행사를 선택한 뒤 해당 상세페이지 텍스트를 붙여넣으면 상품정보·가격캘린더가 자동 채워집니다.
            </p>
            <div className="mt-2">
              <label className="mb-1 block text-xs font-medium text-bt-muted">여행사 선택</label>
              <select
                value={selectedBrandKey}
                onChange={(e) => {
                  const key = e.target.value
                  setSelectedBrandKey(key)
                  const b = brands.find((x) => x.brandKey === key)
                  if (b) setOrganizerName(b.displayName)
                }}
                className="w-full rounded-lg border border-bt-border-strong bg-bt-surface px-3 py-2 text-sm text-bt-strong focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
              >
                {brands.map((b) => (
                  <option key={b.brandKey} value={b.brandKey}>{b.displayName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-1 flex-col min-h-0 p-4">
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="상세페이지에서 복사한 HTML 또는 텍스트를 붙여넣으세요."
              className="min-h-[200px] flex-1 resize-none rounded-lg border border-bt-border-strong p-3 text-sm focus:border-bt-brand-blue-strong focus:ring-2 focus:ring-bt-brand-blue-soft"
              rows={12}
            />
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                onClick={handleExtract}
                disabled={loading}
                className="flex items-center justify-center gap-2 rounded-lg bg-bt-cta-primary px-4 py-3 text-sm font-medium text-bt-cta-primary-fg hover:bg-bt-cta-primary-hover disabled:opacity-50"
              >
                {loading ? '추출 중…' : 'AI 추출 (상품정보 + 가격캘린더)'}
              </button>
              {error && <p className="text-sm text-bt-danger">{error}</p>}
              {saveResult && (
                <div className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                  <p className="font-medium">{saveResult.message}</p>
                  <p className="mt-1 text-green-700">등록대기 목록에서 사진 수집 여부를 확인한 뒤 검수 후 등록하세요.</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <a
                      href="/admin/pending"
                      className="font-medium text-bt-link underline hover:no-underline"
                    >
                      등록대기 목록에서 확인
                    </a>
                    <a
                      href={saveResult.detailPath}
                      className="text-bt-link underline hover:no-underline"
                    >
                      상품 상세(검수)
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
