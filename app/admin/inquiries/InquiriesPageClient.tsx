'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import AdminEmptyState from '../components/AdminEmptyState'
import AdminKpiCard from '../components/AdminKpiCard'
import AdminPageHeader from '../components/AdminPageHeader'
import InquiryListTable from '@/components/admin/InquiryListTable'
import {
  type AdminInquiryListItem,
  INQUIRY_ADMIN_STATUSES,
  INQUIRY_LEAD_TIME_RISKS,
  inquiryStatusLabel,
  inquiryTypeLabel,
  leadTimeRiskLabel,
} from '@/lib/admin-inquiry'
import { CUSTOMER_INQUIRY_TYPES } from '@/lib/customer-inquiry-intake'

function buildListQueryString(searchParams: URLSearchParams): string {
  const p = new URLSearchParams()
  const t = searchParams.get('inquiryType')
  const s = searchParams.get('status')
  const r = searchParams.get('leadTimeRisk')
  if (t) p.set('inquiryType', t)
  if (s) p.set('status', s)
  if (r) p.set('leadTimeRisk', r)
  return p.toString()
}

export default function InquiriesPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qsKey = searchParams.toString()

  const [rows, setRows] = useState<AdminInquiryListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [patchError, setPatchError] = useState<string | null>(null)

  const setFilter = useCallback(
    (key: 'inquiryType' | 'status' | 'leadTimeRisk', value: string) => {
      const p = new URLSearchParams(searchParams.toString())
      if (!value) p.delete(key)
      else p.set(key, value)
      router.replace(`/admin/inquiries?${p.toString()}`)
    },
    [router, searchParams]
  )

  const inquiryType = searchParams.get('inquiryType') ?? ''
  const status = searchParams.get('status') ?? ''
  const leadTimeRisk = searchParams.get('leadTimeRisk') ?? ''

  const fetchList = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    const q = buildListQueryString(searchParams)
    fetch(`/api/admin/inquiries${q ? `?${q}` : ''}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          inquiries?: AdminInquiryListItem[]
          error?: string
        }
        if (!res.ok) {
          setLoadError(data.error ?? '목록을 불러오지 못했습니다.')
          setRows([])
          return
        }
        setRows(Array.isArray(data.inquiries) ? data.inquiries : [])
      })
      .catch(() => {
        setLoadError('네트워크 오류가 발생했습니다.')
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [searchParams])

  useEffect(() => {
    fetchList()
  }, [fetchList, qsKey])

  const onStatusUpdated = useCallback((id: string, nextStatus: string) => {
    setPatchError(null)
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: nextStatus } : r)))
  }, [])

  const urgentCount = useMemo(() => rows.filter((r) => r.leadTimeRisk === 'urgent').length, [rows])
  const receivedCount = useMemo(() => rows.filter((r) => r.status === 'received').length, [rows])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] p-6">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#0f172a]">
            ← 대시보드
          </Link>
        </div>

        <AdminPageHeader
          title="문의 접수"
          subtitle="고객 문의를 유형·상태·리드타임으로 빠르게 훑고, 상태만 최소 변경합니다. 상세·메모는 추후 단계에서 확장합니다."
        />

        {!loading && (
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <AdminKpiCard label="표시 건수" value={`${rows.length}건`} tone="muted" />
            <AdminKpiCard label="긴급(리드타임)" value={`${urgentCount}건`} tone="muted" />
            <AdminKpiCard label="상태: 접수" value={`${receivedCount}건`} tone="muted" />
          </section>
        )}

        <section className="mb-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-gray-800">필터</h2>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex min-w-[160px] flex-col gap-1">
              <label htmlFor="filter-inquiry-type" className="text-xs font-medium text-gray-600">
                문의 유형
              </label>
              <select
                id="filter-inquiry-type"
                className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 shadow-sm"
                value={inquiryType}
                onChange={(e) => setFilter('inquiryType', e.target.value)}
              >
                <option value="">전체</option>
                {CUSTOMER_INQUIRY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {inquiryTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[140px] flex-col gap-1">
              <label htmlFor="filter-status" className="text-xs font-medium text-gray-600">
                상태
              </label>
              <select
                id="filter-status"
                className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 shadow-sm"
                value={status}
                onChange={(e) => setFilter('status', e.target.value)}
              >
                <option value="">전체</option>
                {INQUIRY_ADMIN_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {inquiryStatusLabel(s)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-[130px] flex-col gap-1">
              <label htmlFor="filter-risk" className="text-xs font-medium text-gray-600">
                리드타임
              </label>
              <select
                id="filter-risk"
                className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-gray-900 shadow-sm"
                value={leadTimeRisk}
                onChange={(e) => setFilter('leadTimeRisk', e.target.value)}
              >
                <option value="">전체</option>
                {INQUIRY_LEAD_TIME_RISKS.map((r) => (
                  <option key={r} value={r}>
                    {leadTimeRiskLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500">
              정렬: 긴급 → 촉박 → 보통, 같은 그룹 내 최신 접수순. 필터는 URL에 반영됩니다.
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 border-l-4 border-[#0f172a] pl-3 text-base font-semibold text-[#0f172a]">
            문의 목록
          </h2>
          {loading ? (
            <div className="flex justify-center py-12 text-gray-500">로딩 중…</div>
          ) : loadError ? (
            <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
              {loadError}
            </p>
          ) : rows.length === 0 ? (
            <AdminEmptyState
              title="표시할 문의가 없습니다"
              description="필터를 바꾸거나 공개 문의 폼에서 접수가 들어오면 여기에 표시됩니다."
              actionLabel="필터 초기화"
              actionHref="/admin/inquiries"
            />
          ) : (
            <InquiryListTable
              rows={rows}
              onStatusUpdated={onStatusUpdated}
              patchError={patchError}
              onPatchError={setPatchError}
            />
          )}
        </section>
      </div>
    </div>
  )
}
