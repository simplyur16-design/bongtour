'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import AdminEmptyState from '@/app/admin/components/AdminEmptyState'
import type { SixMonthNoPricePurgeCandidate } from '@/lib/product-six-month-price-purge'
import type { SixMonthVerificationMarkerSource } from '@/lib/product-six-month-price-verification'
import { AlertTriangle, ExternalLink, RefreshCw, Trash2 } from 'lucide-react'

type ApiResponse = {
  items: SixMonthNoPricePurgeCandidate[]
  total: number
  policy?: { horizonDays: number }
}

function markerLabel(source: SixMonthVerificationMarkerSource): string {
  if (source === 'calendar_batch_retired') return 'E2E 달력 6개월 스캔 완료'
  return '라이브 180일 가격 확인'
}

function formatKst(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  } catch {
    return iso
  }
}

export default function SixMonthPurgeRecommendationsPage() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const r = await fetch('/api/admin/products/six-month-purge-recommendations?limit=200', {
        credentials: 'include',
      })
      if (!r.ok) {
        setErr(`목록 로드 실패 (${r.status})`)
        setData(null)
        return
      }
      setData((await r.json()) as ApiResponse)
    } catch {
      setErr('네트워크 오류')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const deletableCount = useMemo(
    () => (data?.items ?? []).filter((i) => i.bookingCount === 0).length,
    [data?.items],
  )

  async function deleteOne(row: SixMonthNoPricePurgeCandidate) {
    if (row.bookingCount > 0) {
      setMsg('예약이 연결된 상품은 삭제할 수 없습니다.')
      return
    }
    const ok = window.confirm(
      `「${row.title}」 상품을 DB에서 삭제합니다.\n\n향후 6개월 성인가가 없고 검증 마커가 확인된 상품입니다. 계속할까요?`,
    )
    if (!ok) return

    setBusyId(row.id)
    setMsg(null)
    try {
      const r = await fetch(`/api/admin/products/six-month-purge-recommendations/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (!r.ok) {
        setMsg(j.error ?? `삭제 실패 (${r.status})`)
        return
      }
      setMsg('삭제했습니다.')
      await load()
    } catch {
      setMsg('네트워크 오류')
    } finally {
      setBusyId(null)
    }
  }

  const todayYmd = data?.items[0]?.todaySeoulYmd
  const horizonYmd = data?.items[0]?.horizonYmd

  return (
    <div className="mx-auto max-w-[1280px] space-y-6">
      <AdminPageHeader
        title="6개월 미가격 · 삭제 권고"
        subtitle="E2E 달력 배치 또는 라이브 스크래퍼가 향후 180일을 확인했는데 성인가 있는 출발이 없는 상품만 표시합니다. 미수집·부분 수집 상품은 여기에 나오지 않습니다."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            새로고침
          </button>
        }
      />

      <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">삭제 전 확인</p>
            <ul className="list-inside list-disc space-y-0.5 text-amber-900/90">
              <li>
                검증 마커: <strong>E2E 달력 지평선 완료</strong> 또는{' '}
                <strong>라이브 180일 확인</strong> (`noFutureDepartureConfirmedAt`)
              </li>
              <li>
                가격 기준: 서울 오늘
                {todayYmd ? ` (${todayYmd})` : ''} ~ {horizonYmd ?? '오늘+180일'} 구간 성인가 &gt; 0 출발 없음
              </li>
              <li>예약이 연결된 상품은 삭제 버튼이 비활성화됩니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {msg ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">{msg}</p>
      ) : null}
      {err ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</p>
      ) : null}

      {loading && !data ? (
        <p className="text-sm text-slate-500">목록을 불러오는 중…</p>
      ) : null}

      {!loading && data && data.items.length === 0 ? (
        <AdminEmptyState
          title="삭제 권고 상품 없음"
          description="6개월 검증이 끝났는데 미래 성인가가 없는 등록 상품이 없거나, 아직 검증 마커가 없는 상품만 남아 있습니다."
        />
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <p className="text-sm text-slate-600">
            권고 <strong>{data.total}</strong>건 · 즉시 삭제 가능 <strong>{deletableCount}</strong>건
          </p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[960px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2.5">상품</th>
                  <th className="px-3 py-2.5">공급사</th>
                  <th className="px-3 py-2.5">상태</th>
                  <th className="px-3 py-2.5">검증 마커</th>
                  <th className="px-3 py-2.5">라이브 확인 시각</th>
                  <th className="px-3 py-2.5 text-center">예약</th>
                  <th className="px-3 py-2.5 text-right">작업</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((row) => {
                  const canDelete = row.bookingCount === 0
                  return (
                    <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                      <td className="max-w-[280px] px-3 py-3">
                        <div className="font-medium text-slate-900 line-clamp-2">{row.title}</div>
                        <div className="mt-0.5 font-mono text-xs text-slate-500">{row.slug ?? row.id}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{row.originSource ?? '—'}</td>
                      <td className="px-3 py-3 text-slate-700">{row.registrationStatus ?? '—'}</td>
                      <td className="px-3 py-3">
                        <ul className="space-y-1">
                          {row.markerSources.map((s) => (
                            <li key={s}>
                              <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900">
                                {markerLabel(s)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                        {formatKst(row.noFutureDepartureConfirmedAt)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {row.bookingCount > 0 ? (
                          <span className="font-semibold text-rose-700">{row.bookingCount}</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/products/${row.id}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                          >
                            관리
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                          <button
                            type="button"
                            disabled={!canDelete || busyId === row.id}
                            onClick={() => void deleteOne(row)}
                            className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3 w-3" />
                            {busyId === row.id ? '삭제 중…' : '삭제'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
