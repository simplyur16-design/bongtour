'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { OVERSEAS_SUPPLIER_LABEL } from '@/lib/normalize-supplier-origin'

type TravelDashboardSupplierKey = CanonicalOverseasSupplierKey | 'custom'

const TRAVEL_DASHBOARD_SUPPLIER_OPTIONS: { key: TravelDashboardSupplierKey; bodyOriginSource: string }[] = [
  { key: 'hanatour', bodyOriginSource: 'hanatour' },
  { key: 'modetour', bodyOriginSource: 'modetour' },
  { key: 'ybtour', bodyOriginSource: 'ybtour' },
  { key: 'verygoodtour', bodyOriginSource: 'verygoodtour' },
  { key: 'custom', bodyOriginSource: '직접입력' },
]

type PriceRow = {
  date: string
  adultBase: number
  adultFuel: number
  childBedBase?: number
  childNoBedBase?: number
  childFuel: number
  infantBase?: number
  infantFuel: number
  status: string
  availableSeats: number
}

type ParsedResult = {
  originSource?: string
  originCode: string
  title: string
  destination: string
  duration: string
  isFuelIncluded?: boolean
  isGuideFeeIncluded?: boolean
  mandatoryLocalFee?: number | null
  mandatoryCurrency?: string | null
  includedText?: string | null
  excludedText?: string | null
  prices: PriceRow[]
  itineraries: unknown[]
}

type SaveResult = {
  ok: boolean
  isNew: boolean
  productId: string
  originCode: string
  detailPath: string
  message: string
  parsed: ParsedResult
}

type ProductRow = {
  id: string
  originCode: string
  title: string
  destination: string
  duration: string
  updatedAt: string
}

export default function TravelDashboardPage() {
  const [rawText, setRawText] = useState('')
  const [supplierKey, setSupplierKey] = useState<TravelDashboardSupplierKey>('hanatour')
  const requestOriginSource =
    supplierKey === 'custom'
      ? TRAVEL_DASHBOARD_SUPPLIER_OPTIONS.find((o) => o.key === 'custom')!.bodyOriginSource
      : supplierKey
  const [loading, setLoading] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState('')
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const [previewParsed, setPreviewParsed] = useState<ParsedResult | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])

  const fetchProducts = useCallback(() => {
    fetch('/api/admin/products/v2')
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setProducts(data) : null))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  async function handlePreview() {
    if (!rawText.trim()) {
      setError('텍스트를 붙여넣어 주세요.')
      return
    }
    setError('')
    setLoadingPreview(true)
    try {
      const res = await fetch('/api/travel/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, originSource: requestOriginSource, auth: 'bongtour2026' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '파싱 실패')
      setPreviewParsed(data.parsed)
    } catch (e) {
      setError(e instanceof Error ? e.message : '파싱 실패')
    } finally {
      setLoadingPreview(false)
    }
  }

  async function handleParseAndSave() {
    if (!rawText.trim()) {
      setError('여행사 원본 텍스트를 붙여넣어 주세요.')
      return
    }
    setError('')
    setSaveResult(null)
    setLoading(true)
    try {
      const res = await fetch('/api/travel/parse-and-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText, originSource: requestOriginSource }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '파싱 또는 저장 실패')
      setSaveResult(data)
      setPreviewParsed(data.parsed)
      fetchProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : '실패')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveCurrentPreview() {
    if (!previewParsed?.originCode) {
      setError('미리보기 데이터가 없습니다. 먼저 파싱 미리보기를 실행하세요.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const payload: ParsedResult = {
        ...previewParsed,
        originSource: requestOriginSource,
      }
      const res = await fetch('/api/travel/parse-and-upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsed: payload, originSource: requestOriginSource }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '저장 실패')
      setSaveResult({
        ok: true,
        isNew: data.isNew ?? true,
        productId: data.productId,
        originCode: data.originCode,
        detailPath: data.detailPath ?? `/admin/products/${data.productId}`,
        message: data.message ?? '저장되었습니다.',
        parsed: previewParsed,
      })
      fetchProducts()
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setLoading(false)
    }
  }

  function updatePreviewPrice(index: number, field: keyof PriceRow, value: number | string) {
    if (!previewParsed?.prices?.[index]) return
    setPreviewParsed((prev) => {
      if (!prev) return prev
      const next = [...prev.prices]
      next[index] = { ...next[index], [field]: value }
      return { ...prev, prices: next }
    })
  }

  const parsed = saveResult?.parsed ?? previewParsed

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 shadow-sm">
        <h1 className="text-lg font-bold text-gray-900">여행 데이터 파싱 대시보드</h1>
        <div className="flex items-center gap-3">
          <Link href="/admin/sync" className="text-sm text-gray-500 hover:text-gray-900">
            실시간 동기화
          </Link>
          <Link href="/admin/register" className="text-sm font-medium text-orange-600 hover:text-orange-800">
            상품 등록
          </Link>
          <Link href="/admin/products" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            저장된 상품
          </Link>
          <Link href="/admin/bookings" className="text-sm font-medium text-green-600 hover:text-gray-900">
            예약 관리
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 입력 영역 */}
          <section className="lg:col-span-1">
            <div className="border border-gray-200 bg-white p-5">
              <h2 className="mb-3 border-l-4 border-[#0f172a] pl-3 text-sm font-semibold text-[#0f172a]">원본 텍스트 주입</h2>
              <p className="mb-3 text-xs text-gray-500">
                하나투어/모두투어 등 상세페이지에서 복사한 텍스트를 붙여넣고 파싱·저장하세요. 동일 상품코드는
                업데이트됩니다.
              </p>
              <div className="mb-3">
                <label className="mb-1 block text-xs font-medium text-gray-600">여행사</label>
                <select
                  value={supplierKey}
                  onChange={(e) => setSupplierKey(e.target.value as TravelDashboardSupplierKey)}
                  className="w-full border border-gray-300 px-3 py-2 text-sm"
                >
                  {TRAVEL_DASHBOARD_SUPPLIER_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.key === 'custom' ? '직접입력' : OVERSEAS_SUPPLIER_LABEL[o.key]}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="상세페이지 텍스트를 붙여넣으세요..."
                rows={12}
                className="w-full resize-none border border-gray-300 p-3 text-sm focus:border-[#0f172a] focus:ring-1 focus:ring-[#0f172a]"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={loadingPreview}
                  className="flex-1 border border-[#0f172a] bg-white px-3 py-2.5 text-sm font-medium text-[#0f172a] hover:bg-gray-50 disabled:opacity-50"
                >
                  {loadingPreview ? '미리보기 중…' : '파싱 미리보기'}
                </button>
                <button
                  type="button"
                  onClick={handleParseAndSave}
                  disabled={loading}
                  className="flex-1 border border-[#0f172a] bg-[#0f172a] px-3 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
                >
                  {loading ? '저장 중…' : '파싱 후 DB 저장'}
                </button>
              </div>
              {previewParsed && (
                <button
                  type="button"
                  onClick={handleSaveCurrentPreview}
                  disabled={loading}
                  className="mt-2 w-full border border-[#0f172a] bg-[#0f172a] px-3 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
                >
                  현재 미리보기 내용으로 DB 저장
                </button>
              )}
              {error && (
                <div className="mt-3 border-l-4 border-[#0f172a] bg-white py-2 pl-3 text-sm text-[#0f172a]">
                  {error}
                </div>
              )}
            </div>
          </section>

          {/* 파싱 결과 요약 (포함/불포함·현지비) */}
          <section className="lg:col-span-2">
            {(saveResult || previewParsed) ? (
              <div className="space-y-4">
                {saveResult && (
                  <div className="flex flex-wrap items-center gap-3 border border-emerald-200 bg-[#ecfdf5] p-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">안내</p>
                      <p className="mt-1 font-medium text-emerald-800">{saveResult.message}</p>
                      <p className="text-sm text-emerald-700">
                        상품코드: <strong>{saveResult.originCode}</strong>
                        {saveResult.isNew ? ' (신규)' : ' (업데이트)'}
                      </p>
                    </div>
                    <Link
                      href={saveResult.detailPath}
                      className="ml-auto border border-emerald-700 bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                    >
                      상품 상세 보기
                    </Link>
                  </div>
                )}

                {parsed && (
                  <>
                    {/* 현지 지불 (외화) - 원화와 분리하여 병기 */}
                    {(parsed.mandatoryLocalFee != null || parsed.mandatoryCurrency) && (
                      <div className="border-l-4 border-[#fde68a] border-b border-dotted border-[#fde68a] bg-white p-4">
                        <h3 className="text-sm font-semibold text-amber-900">현지 지불 (외화) — 원화와 별도</h3>
                        <p className="mt-1 text-lg font-bold text-amber-800">
                          {parsed.mandatoryLocalFee != null ? parsed.mandatoryLocalFee : '-'} {parsed.mandatoryCurrency ?? ''}
                        </p>
                        <p className="mt-0.5 text-xs text-amber-700">한국 결제액과 합산하지 않고 병기합니다.</p>
                      </div>
                    )}

                    <div className="border border-gray-200 bg-white p-5">
                      <h2 className="mb-3 border-l-4 border-[#0f172a] pl-3 text-sm font-semibold text-[#0f172a]">추출 결과 요약</h2>
                      <div className="grid gap-4 sm:grid-cols-2">
                      <div className="border border-gray-200 bg-gray-50 p-4">
                        <h3 className="mb-2 text-xs font-medium text-gray-500">포함/불포함 · 현지비</h3>
                        <ul className="space-y-1 text-sm">
                          <li>
                            유류할증료:{' '}
                            <span className={parsed.isFuelIncluded ? 'text-green-700' : 'text-amber-700'}>
                              {parsed.isFuelIncluded ? '포함' : '별도'}
                            </span>
                          </li>
                          <li>
                            가이드/기사 경비:{' '}
                            <span className={parsed.isGuideFeeIncluded ? 'text-green-700' : 'text-amber-700'}>
                              {parsed.isGuideFeeIncluded ? '포함' : '현지 지불'}
                            </span>
                          </li>
                          {(parsed.mandatoryLocalFee != null || parsed.mandatoryCurrency) && (
                            <li>
                              현지 필수 지불:{' '}
                              <strong>
                                {parsed.mandatoryLocalFee != null ? parsed.mandatoryLocalFee : '-'}{' '}
                                {parsed.mandatoryCurrency ?? ''}
                              </strong>
                            </li>
                          )}
                        </ul>
                        {parsed.includedText && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500">포함 내역</p>
                            <p className="mt-0.5 max-h-20 overflow-y-auto whitespace-pre-wrap text-xs text-gray-700">
                              {parsed.includedText.slice(0, 300)}
                              {parsed.includedText.length > 300 ? '…' : ''}
                            </p>
                          </div>
                        )}
                        {parsed.excludedText && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-gray-500">불포함 내역</p>
                            <p className="mt-0.5 max-h-20 overflow-y-auto whitespace-pre-wrap text-xs text-amber-800">
                              {parsed.excludedText.slice(0, 300)}
                              {parsed.excludedText.length > 300 ? '…' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="border border-gray-200 bg-gray-50 p-4">
                        <h3 className="mb-2 text-xs font-medium text-gray-500">상품 · 가격 · 일정</h3>
                        <ul className="space-y-1 text-sm">
                          <li>
                            <strong>{parsed.title}</strong>
                          </li>
                          <li>
                            {parsed.destination} · {parsed.duration}
                          </li>
                          <li>가격 일수: {Array.isArray(parsed.prices) ? parsed.prices.length : 0}건</li>
                          <li>일정: {Array.isArray(parsed.itineraries) ? parsed.itineraries.length : 0}일</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                    {/* 가격 캘린더 (엑셀 그리드, 한 화면 전체, 직접 수정 가능) */}
                    {Array.isArray(parsed.prices) && parsed.prices.length > 0 && (
                      <div className="border border-gray-200 bg-white p-5">
                        <h2 className="mb-3 border-l-4 border-[#0f172a] pl-3 text-sm font-semibold text-[#0f172a]">가격 캘린더 (엑셀 그리드 · 직접 수정 가능)</h2>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[800px] text-xs">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border-b border-r border-gray-200 px-2 py-2 text-left font-medium">날짜</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">상태</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">좌석</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">성인(기본)</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">성인(유류)</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">아동베드(기본)</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">노베드(기본)</th>
                                <th className="border-b border-r border-gray-200 px-2 py-2 font-medium">유아(기본)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parsed.prices.map((row, i) => (
                                <tr key={row.date} className="border-b border-gray-100">
                                  <td className="border-r border-gray-100 px-2 py-1 font-medium">{row.date}</td>
                                  <td className="border-r border-gray-100">
                                    <select
                                      value={row.status}
                                      onChange={(e) => updatePreviewPrice(i, 'status', e.target.value)}
                                      className="w-full rounded border border-gray-200 bg-white px-1 py-0.5"
                                    >
                                      <option value="출발확정">출발확정</option>
                                      <option value="예약가능">예약가능</option>
                                      <option value="마감">마감</option>
                                    </select>
                                  </td>
                                  <td className="border-r border-gray-100">
                                    <input
                                      type="number"
                                      min={0}
                                      value={row.availableSeats ?? ''}
                                      onChange={(e) => updatePreviewPrice(i, 'availableSeats', parseInt(e.target.value, 10) || 0)}
                                      className="w-14 rounded border border-gray-200 px-1 py-0.5 text-right"
                                    />
                                  </td>
                                  <td className="border-r border-gray-100">
                                    <input
                                      type="number"
                                      value={row.adultBase ?? ''}
                                      onChange={(e) => updatePreviewPrice(i, 'adultBase', parseInt(e.target.value, 10) || 0)}
                                      className="w-20 rounded border border-gray-200 px-1 py-0.5 text-right"
                                    />
                                  </td>
                                  <td className="border-r border-gray-100">
                                    <input
                                      type="number"
                                      value={row.adultFuel ?? ''}
                                      onChange={(e) => updatePreviewPrice(i, 'adultFuel', parseInt(e.target.value, 10) || 0)}
                                      className="w-20 rounded border border-gray-200 px-1 py-0.5 text-right"
                                    />
                                  </td>
                                  <td className="border-r border-gray-100">
                                    <input
                                      type="number"
                                      value={row.childBedBase ?? ''}
                                      onChange={(e) => updatePreviewPrice(i, 'childBedBase', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                                      className="w-20 rounded border border-gray-200 px-1 py-0.5 text-right"
                                    />
                                  </td>
                                  <td className="border-r border-gray-100">
                                    <input
                                      type="number"
                                      value={row.childNoBedBase ?? ''}
                                      onChange={(e) => updatePreviewPrice(i, 'childNoBedBase', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                                      className="w-20 rounded border border-gray-200 px-1 py-0.5 text-right"
                                    />
                                  </td>
                                  <td className="border-gray-100">
                                    <input
                                      type="number"
                                      value={row.infantBase ?? ''}
                                      onChange={(e) => updatePreviewPrice(i, 'infantBase', e.target.value === '' ? 0 : parseInt(e.target.value, 10))}
                                      className="w-20 rounded border border-gray-200 px-1 py-0.5 text-right"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center border border-dashed border-gray-300 bg-white py-16 text-center">
                <p className="text-sm text-gray-500">텍스트를 붙여넣고 [파싱 후 DB 저장]을 실행하면 결과가 여기에 표시됩니다.</p>
              </div>
            )}

            {/* 저장된 상품 목록 */}
            <div className="mt-6 border border-gray-200 bg-white p-5">
              <h2 className="mb-3 border-l-4 border-[#0f172a] pl-3 text-sm font-semibold text-[#0f172a]">저장된 상품 (한눈에 보기)</h2>
              {products.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-500">저장된 상품이 없습니다.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-2 pr-4 font-medium">상품코드</th>
                        <th className="pb-2 pr-4 font-medium">상품명</th>
                        <th className="pb-2 pr-4 font-medium">여행지</th>
                        <th className="pb-2 font-medium">갱신</th>
                      </tr>
                    </thead>
                    <tbody>
                      {products.slice(0, 20).map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-2 pr-4 font-mono text-gray-700">{p.originCode}</td>
                          <td className="py-2 pr-4 truncate max-w-[200px]">{p.title}</td>
                          <td className="py-2 pr-4">{p.destination}</td>
                          <td className="py-2">
                            <Link
                              href={`/admin/products/${p.id}`}
                              className="text-orange-600 hover:underline"
                            >
                              보기
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
