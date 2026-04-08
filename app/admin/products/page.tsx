'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AdminEmptyState from '../components/AdminEmptyState'
import AdminKpiCard from '../components/AdminKpiCard'
import AdminPageHeader from '../components/AdminPageHeader'
import AdminStatusBadge from '../components/AdminStatusBadge'
import { adminProductBgImageAttributionLine, adminProductBgImageSourceTypeLabel } from '@/lib/product-bg-image-attribution'

type ProductRow = {
  id: string
  originSource: string
  originCode: string
  title: string
  destination: string | null
  destinationRaw: string | null
  primaryDestination: string | null
  supplierGroupId: string | null
  priceFrom: number | null
  priceCurrency: string | null
  duration: string | null
  airline: string | null
  mandatoryLocalFee: number | null
  schedule: string | null
  registrationStatus: string | null
  updatedAt: string
  hasError: boolean
  scheduleDays: number
  primaryRegion: string | null
  displayCategory: string | null
  themeTags: string | null
  rejectReason: string | null
  rejectedAt: string | null
  hasPrimaryImage: boolean
  bgImageUrl: string | null
  bgImageSource: string | null
  bgImageIsGenerated: boolean
  needsImageReview: boolean
  imageReviewRequestedAt: string | null
}

type ListResponse = {
  items: ProductRow[]
  total: number
  page: number
  totalPages: number
  limit: number
  imageKpi?: { withImage: number; legacy: number; pexels: number; gemini: number; needsImageReviewCount?: number }
}

type OptionsResponse = {
  airlines: string[]
  destinations: string[]
  primaryRegions?: string[]
  displayCategories?: string[]
}

/**
 * 데이터 불완전: 일정 JSON(schedule)이 비어 있을 때만.
 * (구버전: schedule 일수 < 5 또는 현지가이드비 미입력 → 3박4일·가이드비 없음 상품까지 전부 불완전으로 오판)
 */
function isIncomplete(p: ProductRow): boolean {
  return p.scheduleDays === 0
}

/** 배지 색만 source_type 키 기준 (문구는 adminProductBgImageAttributionLine) */
const IMAGE_SOURCE_BADGE_CLASS: Record<string, string> = {
  pexels: 'bg-sky-100 text-sky-900',
  istock: 'bg-slate-200 text-slate-900',
  photo_owned: 'bg-emerald-100 text-emerald-900',
  gemini: 'bg-violet-100 text-violet-800',
  gemini_auto: 'bg-indigo-100 text-indigo-900',
  gemini_manual: 'bg-violet-100 text-violet-900',
  manual: 'bg-slate-100 text-slate-700',
  'destination-set': 'bg-teal-100 text-teal-800',
  photopool: 'bg-emerald-100 text-emerald-800',
  'city-asset': 'bg-teal-100 text-teal-800',
  'attraction-asset': 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-600',
  legacy: 'bg-gray-100 text-gray-600',
}

function getImageSourceDisplay(p: ProductRow): { label: string; className: string } {
  if (!p.hasPrimaryImage) return { label: '—', className: '' }
  const raw = (p.bgImageSource ?? '').trim().toLowerCase()
  if (!raw) {
    return { label: adminProductBgImageSourceTypeLabel(null), className: IMAGE_SOURCE_BADGE_CLASS.legacy }
  }
  const label = adminProductBgImageAttributionLine(p.bgImageSource, p.bgImageIsGenerated)
  const className = IMAGE_SOURCE_BADGE_CLASS[raw] ?? 'bg-gray-100 text-gray-600'
  return { label, className }
}

/** 분류 한 줄 요약: 대표지역 · 노출카테고리 · 테마(앞일부). 툴팁에 전체 노출. */
function getClassificationSummary(p: ProductRow): { line: string; tooltip: string } {
  const parts = [p.primaryRegion, p.displayCategory, p.themeTags].filter(Boolean)
  const tooltip = parts.join(' · ')
  const themeShort = p.themeTags
    ? p.themeTags.split(',')[0].trim() + (p.themeTags.includes(',') ? '…' : '')
    : ''
  const line = [p.primaryRegion, p.displayCategory].filter(Boolean).join(' · ') + (themeShort ? ` (${themeShort})` : '') || '—'
  return { line, tooltip: tooltip || '—' }
}

/** 상품 상세의 「대표 이미지 · 출처」섹션 앵커 — 보강 보내기 후 바로 수정 화면으로 이동 */
const ADMIN_PRODUCT_HERO_ANCHOR = '#admin-product-hero-image'

export default function AdminProductsPage() {
  const router = useRouter()
  const [data, setData] = useState<ListResponse | null>(null)
  const [options, setOptions] = useState<OptionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [airline, setAirline] = useState('')
  const [destination, setDestination] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [primaryRegionFilter, setPrimaryRegionFilter] = useState('')
  const [displayCategoryFilter, setDisplayCategoryFilter] = useState('')
  const [themeTagsSearch, setThemeTagsSearch] = useState('')
  const [hasErrorOnly, setHasErrorOnly] = useState(false)
  const [imageSourceFilter, setImageSourceFilter] = useState('')
  const [legacyOnly, setLegacyOnly] = useState(false)
  const [needsImageReviewFilter, setNeedsImageReviewFilter] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueMessage, setQueueMessage] = useState<string | null>(null)
  const [imageReviewLoading, setImageReviewLoading] = useState(false)
  const [imageReviewMessage, setImageReviewMessage] = useState<string | null>(null)
  const [registeringId, setRegisteringId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchOptions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/products/list/options')
      if (res.ok) {
        const json = await res.json()
        setOptions(json)
      }
    } catch {
      // ignore
    }
  }, [])

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (airline) params.set('airline', airline)
      if (destination) params.set('destination', destination)
      if (statusFilter) params.set('status', statusFilter)
      if (primaryRegionFilter) params.set('primaryRegion', primaryRegionFilter)
      if (displayCategoryFilter) params.set('displayCategory', displayCategoryFilter)
      if (themeTagsSearch) params.set('themeTags', themeTagsSearch)
      if (hasErrorOnly) params.set('hasError', '1')
      if (imageSourceFilter) params.set('imageSource', imageSourceFilter)
      if (legacyOnly && !imageSourceFilter) params.set('legacyOnly', '1')
      if (needsImageReviewFilter) params.set('needsImageReview', '1')
      const res = await fetch(`/api/admin/products/list?${params}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        setData(null)
      }
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [page, airline, destination, statusFilter, primaryRegionFilter, displayCategoryFilter, themeTagsSearch, hasErrorOnly, imageSourceFilter, legacyOnly, needsImageReviewFilter])

  useEffect(() => {
    fetchOptions()
  }, [fetchOptions])

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      if (q.get('imageRepair') === '1' || q.get('needsImageReview') === '1') setNeedsImageReviewFilter(true)
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (!data?.items.length) return
    const allIds = data.items.map((p) => p.id)
    const allSelected = allIds.every((id) => selected.has(id))
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        allIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        allIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  /** 공급사별 live 어댑터(POST …/departures)로 즉시 재수집. (스케줄러 큐는 봇 실행 시에만 처리됨) */
  const handleAddToQueue = async () => {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    setQueueLoading(true)
    setQueueMessage(null)
    let ok = 0
    const failLines: string[] = []
    try {
      let fallbackCount = 0
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i]
        setQueueMessage(`재수집 중 ${i + 1}/${ids.length}…`)
        try {
          const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/departures`, { method: 'POST' })
          const json = (await res.json().catch(() => ({}))) as {
            ok?: boolean
            error?: string
            mode?: string
            source?: string
            liveError?: string | null
          }
          if (res.ok && json?.ok) {
            ok += 1
            if (json.mode === 'fallback-rebuild') fallbackCount += 1
          } else {
            const bits = [
              json?.error ?? `HTTP ${res.status}`,
              json?.mode ? `mode=${json.mode}` : null,
              json?.source ? `source=${json.source}` : null,
              json?.liveError ? `live=${json.liveError.slice(0, 120)}` : null,
            ].filter(Boolean)
            failLines.push(`${id}: ${bits.join(' · ')}`)
          }
        } catch (e) {
          failLines.push(`${id}: ${e instanceof Error ? e.message : '요청 실패'}`)
        }
      }
      const failSummary =
        failLines.length === 0
          ? ''
          : ` · 실패 ${failLines.length}건 (${failLines.slice(0, 2).join(' · ')}${failLines.length > 2 ? ' …' : ''})`
      const fbHint = fallbackCount > 0 ? ` · fallback ${fallbackCount}건` : ''
      setQueueMessage(
        ok === ids.length
          ? `${ok}건 출발일 재수집 완료${fbHint}`
          : `${ok}/${ids.length}건 완료${fbHint}${failSummary}`
      )
      setSelected(new Set())
      await fetchList()
    } catch (e) {
      setQueueMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setQueueLoading(false)
    }
  }

  const handleSendToImageReview = async () => {
    if (selected.size === 0) return
    const productIds = Array.from(selected)
    setImageReviewLoading(true)
    setImageReviewMessage(null)
    try {
      const res = await fetch('/api/admin/products/image-review-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, mode: 'manual' }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        added?: number
        refreshed?: number
        notFound?: number
      }
      if (json.ok) {
        const added = json.added ?? 0
        const refreshed = json.refreshed ?? 0
        const notFound = json.notFound ?? 0
        const worked = added > 0 || refreshed > 0
        const parts = [
          added > 0 ? `${added}건 이미지 보강 대상으로 등록` : null,
          refreshed > 0 ? `요청 시각 갱신 ${refreshed}건` : null,
          notFound > 0 ? `ID 없음 ${notFound}건` : null,
        ].filter(Boolean)
        setImageReviewMessage(
          added > 0 || refreshed > 0 || notFound > 0
            ? parts.join(' · ')
            : '처리할 상품이 없습니다.'
        )
        setSelected(new Set())
        if (worked && productIds.length > 0) {
          router.push(`/admin/products/${productIds[0]}${ADMIN_PRODUCT_HERO_ANCHOR}`)
        } else {
          fetchList()
        }
      } else {
        setImageReviewMessage(json.error ?? '실패')
      }
    } catch (e) {
      setImageReviewMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setImageReviewLoading(false)
    }
  }

  const handleSendOneToImageRepair = async (productId: string) => {
    setImageReviewLoading(true)
    setImageReviewMessage(null)
    try {
      const res = await fetch('/api/admin/products/image-review-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: [productId], mode: 'manual' }),
      })
      const json = (await res.json()) as {
        ok?: boolean
        error?: string
        added?: number
        refreshed?: number
        notFound?: number
      }
      if (!res.ok) {
        setImageReviewMessage(json.error ?? `요청 실패 (${res.status})`)
        return
      }
      if (json.ok) {
        const added = json.added ?? 0
        const refreshed = json.refreshed ?? 0
        const notFound = json.notFound ?? 0
        const worked = added > 0 || refreshed > 0
        if (notFound > 0) {
          setImageReviewMessage('상품을 찾을 수 없습니다.')
          fetchList()
        } else if (worked) {
          router.push(`/admin/products/${productId}${ADMIN_PRODUCT_HERO_ANCHOR}`)
        } else {
          setImageReviewMessage('처리할 수 없습니다.')
          fetchList()
        }
      } else {
        setImageReviewMessage(json.error ?? '실패')
      }
    } catch (e) {
      setImageReviewMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setImageReviewLoading(false)
    }
  }

  const handleRegister = async (productId: string) => {
    setRegisteringId(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationStatus: 'registered' }),
      })
      if (res.ok) fetchList()
    } finally {
      setRegisteringId(null)
    }
  }

  const handleSendToPending = async (productId: string) => {
    setRestoringId(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationStatus: 'pending' }),
      })
      if (res.ok) fetchList()
    } finally {
      setRestoringId(null)
    }
  }

  const handleDelete = async (productId: string) => {
    if (!confirm('이 상품을 삭제할까요? 예약이 있으면 삭제되지 않습니다.')) return
    setDeletingId(productId)
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        fetchList()
      } else {
        alert(json.error ?? '삭제 실패')
      }
    } finally {
      setDeletingId(null)
    }
  }

  const updatedAtStr = (s: string) => {
    try {
      const d = new Date(s)
      return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch {
      return s
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#0f172a]">← 대시보드</Link>
        </div>
        <AdminPageHeader
          title="상품 목록"
          subtitle="운영 중인 상품을 검색·필터하고, 상세에서 노출·가격 동기화를 관리합니다."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/admin/products?imageRepair=1"
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                이미지 보강 대상만 보기
              </Link>
              <button
                type="button"
                onClick={handleAddToQueue}
                disabled={selected.size === 0 || queueLoading}
                className="rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
              >
                {queueLoading ? '처리 중…' : '선택 상품 즉시 재수집'}
                {selected.size > 0 && ` (${selected.size})`}
              </button>
              <button
                type="button"
                onClick={handleSendToImageReview}
                disabled={selected.size === 0 || imageReviewLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {imageReviewLoading ? '처리 중…' : '이미지 보강 대상으로 보내기'}
                {selected.size > 0 && ` (${selected.size})`}
              </button>
              {queueMessage && <span className="bt-wrap text-sm text-gray-500">{queueMessage}</span>}
              {imageReviewMessage && <span className="bt-wrap text-sm text-gray-500">{imageReviewMessage}</span>}
            </div>
          }
        />

        {/* KPI */}
        {!loading && data != null && (
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <AdminKpiCard label="전체 상품" value={`${data.total}건`} tone="muted" />
            <AdminKpiCard label="이번 페이지" value={`${data.items.length}건`} tone="muted" />
            <AdminKpiCard
              label="에러 포함"
              value={`${data.items.filter((p) => p.hasError).length}건`}
              tone="muted"
            />
            {data.imageKpi != null && (
              <>
                <AdminKpiCard label="대표 이미지 있음" value={`${data.imageKpi.withImage}건`} tone="muted" />
                <AdminKpiCard label="legacy" value={`${data.imageKpi.legacy}건`} tone="muted" />
                <AdminKpiCard label="Pexels" value={`${data.imageKpi.pexels}건`} tone="muted" />
                <AdminKpiCard label="Gemini" value={`${data.imageKpi.gemini}건`} tone="muted" />
                {typeof data.imageKpi.needsImageReviewCount === 'number' && (
                  <AdminKpiCard label="이미지 보강 대상" value={`${data.imageKpi.needsImageReviewCount}건`} tone="amber" />
                )}
              </>
            )}
          </section>
        )}

        {/* 필터 */}
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">필터</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">상태 전체</option>
            <option value="registered">등록됨</option>
            <option value="pending">대기</option>
            <option value="on_hold">보류</option>
            <option value="rejected">반려</option>
          </select>
          <select
            value={airline}
            onChange={(e) => {
              setAirline(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">항공사 전체</option>
            {options?.airlines?.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <select
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">지역 전체</option>
            {options?.destinations?.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={primaryRegionFilter}
            onChange={(e) => {
              setPrimaryRegionFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">대표 지역 전체</option>
            {options?.primaryRegions?.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select
            value={displayCategoryFilter}
            onChange={(e) => {
              setDisplayCategoryFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">노출 카테고리 전체</option>
            {options?.displayCategories?.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            value={themeTagsSearch}
            onChange={(e) => {
              setThemeTagsSearch(e.target.value)
              setPage(1)
            }}
            placeholder="테마 태그 검색"
            className="w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-gray-400"
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={hasErrorOnly}
              onChange={(e) => {
                setHasErrorOnly(e.target.checked)
                setPage(1)
              }}
              className="rounded border-gray-400 text-[#0f172a]"
            />
            수집 에러 발생 상품만 보기
          </label>
          <select
            value={imageSourceFilter}
            onChange={(e) => {
              setImageSourceFilter(e.target.value)
              setPage(1)
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
          >
            <option value="">이미지 출처 전체</option>
            <option value="pexels">Pexels</option>
            <option value="gemini">Gemini</option>
            <option value="gemini_auto">Gemini Auto</option>
            <option value="gemini_manual">Gemini Manual</option>
            <option value="photo_owned">photo_owned</option>
            <option value="istock">iStock</option>
            <option value="manual">수동</option>
            <option value="destination-set">도시세트</option>
            <option value="photopool">사진풀</option>
            <option value="legacy">legacy</option>
          </select>
          <label
            className={`flex items-center gap-2 text-sm text-gray-600 ${imageSourceFilter === 'legacy' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={legacyOnly || imageSourceFilter === 'legacy'}
              disabled={imageSourceFilter === 'legacy'}
              onChange={(e) => {
                setLegacyOnly(e.target.checked)
                setPage(1)
              }}
              className="rounded border-gray-400 text-[#0f172a]"
            />
            legacy만 보기
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={needsImageReviewFilter}
              onChange={(e) => {
                setNeedsImageReviewFilter(e.target.checked)
                setPage(1)
              }}
              className="rounded border-gray-400 text-[#0f172a]"
            />
            이미지 보강 대상만
          </label>
        </div>

        {/* 테이블 */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center py-16 text-gray-500">로딩 중…</div>
          ) : !data?.items.length ? (
            <div className="p-8">
              <AdminEmptyState
                title="조건에 맞는 상품이 없습니다"
                description="필터를 바꾸거나 상품 등록·등록대기에서 상품을 추가해 보세요."
                actionLabel="등록대기 보기"
                actionHref="/admin/pending"
              />
            </div>
          ) : (
            <>
              <div className="max-h-[min(72vh,calc(100dvh-18rem))] overflow-y-auto overflow-x-auto overscroll-y-contain [scrollbar-gutter:stable]">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50 shadow-[0_1px_0_0_rgb(229_231_235)]">
                    <tr>
                      <th className="w-12 p-3">
                        <input
                          type="checkbox"
                          checked={data.items.length > 0 && data.items.every((p) => selected.has(p.id))}
                          onChange={toggleSelectAll}
                          className="rounded border-gray-400 text-[#0f172a]"
                        />
                      </th>
                      <th className="p-3 font-semibold text-gray-700">상품코드</th>
                      <th className="p-3 font-semibold text-gray-700">상품명</th>
                      <th className="p-3 font-semibold text-gray-700">항공사</th>
                      <th className="p-3 font-semibold text-gray-700">지역</th>
                      <th className="p-3 font-semibold text-gray-700">단체번호</th>
                      <th className="p-3 font-semibold text-gray-700">대표가격</th>
                      <th className="w-24 p-3 font-semibold text-gray-700">이미지</th>
                      <th className="p-3 font-semibold text-gray-700">분류</th>
                      <th className="p-3 font-semibold text-gray-700">상태</th>
                      <th className="p-3 font-semibold text-gray-700">수정일</th>
                      <th className="p-3 font-semibold text-gray-700">작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((p) => (
                      <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="rounded border-gray-400 text-[#0f172a]"
                          />
                        </td>
                        <td className="p-3 font-mono text-[#0f172a]">{p.originCode}</td>
                        <td className="max-w-[240px] truncate p-3 text-gray-900" title={p.title}>
                          {p.title}
                        </td>
                        <td className="p-3 text-gray-500">{p.airline ?? '—'}</td>
                        <td className="p-3 text-gray-500" title={p.destinationRaw ?? undefined}>
                          {p.primaryDestination ?? p.destination ?? '—'}
                        </td>
                        <td className="p-3 font-mono text-xs text-gray-500">{p.supplierGroupId ?? '—'}</td>
                        <td className="p-3 text-gray-600 whitespace-nowrap">
                          {p.priceFrom != null
                            ? `${p.priceFrom.toLocaleString()}${p.priceCurrency ? ` ${p.priceCurrency}` : ''}`
                            : '—'}
                        </td>
                        <td className="w-24 min-w-[6rem] p-3 align-top">
                          {!p.hasPrimaryImage ? (
                            <span className="text-xs text-gray-400">—</span>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {p.bgImageUrl ? (
                                <div className="h-12 w-20 overflow-hidden rounded border border-gray-200 bg-gray-100">
                                  <img src={p.bgImageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </div>
                              ) : null}
                              <span className="inline-flex w-fit rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800">있음</span>
                              {(() => {
                                const src = getImageSourceDisplay(p)
                                return (
                                  <span
                                    className={`inline-flex w-fit rounded px-1.5 py-0.5 text-[10px] font-medium ${src.className || 'bg-gray-100 text-gray-600'}`}
                                    title={`${p.bgImageSource ?? 'legacy'} · is_generated=${p.bgImageIsGenerated ? '1' : '0'}`}
                                  >
                                    {src.label}
                                  </span>
                                )
                              })()}
                              {p.needsImageReview && (
                                <span className="inline-flex w-fit rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="이미지 보강 검수 대상">보강대상</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="max-w-[160px] truncate p-3 text-xs text-gray-500" title={getClassificationSummary(p).tooltip}>
                          {getClassificationSummary(p).line}
                        </td>
                        <td className="max-w-[200px] p-3">
                          <div className="flex flex-wrap gap-1">
                            {p.registrationStatus === 'registered' && <AdminStatusBadge variant="registered" label="등록됨" />}
                            {p.registrationStatus === 'on_hold' && <AdminStatusBadge variant="on_hold" />}
                            {p.registrationStatus === 'rejected' && <AdminStatusBadge variant="rejected" />}
                            {(!p.registrationStatus || p.registrationStatus === 'pending') && (
                              <AdminStatusBadge variant="pending" label="대기" />
                            )}
                            {p.registrationStatus && !['registered', 'on_hold', 'rejected', 'pending'].includes(p.registrationStatus) && (
                              <AdminStatusBadge variant="pending" label={p.registrationStatus} />
                            )}
                            {p.hasError && <AdminStatusBadge variant="error" label="수집 에러" />}
                            {isIncomplete(p) && (
                              <AdminStatusBadge variant="pending_review" label="데이터 불완전" />
                            )}
                          </div>
                          {p.registrationStatus === 'rejected' && p.rejectReason && (
                            <p className="mt-1 truncate text-xs text-gray-500" title={p.rejectReason}>
                              {p.rejectReason}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-gray-500">{updatedAtStr(p.updatedAt)}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={
                                p.needsImageReview
                                  ? `/admin/products/${p.id}/edit${ADMIN_PRODUCT_HERO_ANCHOR}`
                                  : `/admin/products/${p.id}/edit`
                              }
                              className="rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              상품 편집
                            </Link>
                            <button
                              type="button"
                              onClick={() => void handleSendOneToImageRepair(p.id)}
                              disabled={imageReviewLoading}
                              title={
                                p.needsImageReview
                                  ? '이미 보강 대상 — 클릭 시 요청 시각 갱신 후 대표 이미지 편집 화면으로 이동'
                                  : '보강 대상으로 표시한 뒤, 대표 이미지·출처 편집 화면으로 이동'
                              }
                              className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {p.needsImageReview ? '보강대상' : '보강 보내기'}
                            </button>
                            <Link
                              href={
                                p.needsImageReview
                                  ? `/admin/products/${p.id}${ADMIN_PRODUCT_HERO_ANCHOR}`
                                  : `/admin/products/${p.id}`
                              }
                              className="font-medium text-[#0f172a] hover:underline"
                            >
                              상세
                            </Link>
                            {p.registrationStatus !== 'registered' && (
                              <button
                                type="button"
                                onClick={() => handleRegister(p.id)}
                                disabled={registeringId === p.id}
                                className="rounded-lg bg-[#0f172a] px-2 py-1 text-xs font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
                              >
                                {registeringId === p.id ? '처리 중…' : '편입'}
                              </button>
                            )}
                            {(p.registrationStatus === 'on_hold' || p.registrationStatus === 'rejected') && (
                              <button
                                type="button"
                                onClick={() => handleSendToPending(p.id)}
                                disabled={restoringId === p.id}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                              >
                                {restoringId === p.id ? '처리 중…' : '재검수로 보내기'}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(p.id)}
                              disabled={deletingId === p.id}
                              className="rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50"
                            >
                              {deletingId === p.id ? '삭제 중…' : '삭제'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <p className="text-xs text-gray-500">
                  전체 {data.total}건 · {data.page}/{data.totalPages}페이지 (50개씩)
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={data.page <= 1}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((prev) => Math.min(data.totalPages, prev + 1))}
                    disabled={data.page >= data.totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
