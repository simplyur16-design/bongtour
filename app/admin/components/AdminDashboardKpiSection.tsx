'use client'

/**
 * 관리자 홈 KPI 카드 — 클라이언트 fetch (SSR HTML은 셸만).
 * REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: /api/admin/dashboard-kpi — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: pending = live queue via API — manifest
 * REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: affiliationPendingCount — manifest
 */
import { useCallback, useEffect, useState } from 'react'
import { ADMIN_BTN_SECONDARY_CLASS } from '@/lib/admin-design-system'
import type { AdminDashboardKpi } from '@/lib/admin/dashboard-kpi'
import AdminEmptyState from './AdminEmptyState'
import AdminKpiCard from './AdminKpiCard'

const KPI_TIMEOUT_MS = 8_000

type Props = {
  query: string
  /** 빠른 액션 배지 등 부모 갱신 */
  onKpi?: (kpi: AdminDashboardKpi) => void
}

type LoadState =
  | { status: 'loading' }
  | { status: 'ok'; kpi: AdminDashboardKpi }
  | { status: 'error'; message: string }

function formatCount(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n}건`
}

export default function AdminDashboardKpiSection({ query, onKpi }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  const load = useCallback(async () => {
    setState({ status: 'loading' })
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), KPI_TIMEOUT_MS)
    try {
      const res = await fetch('/api/admin/dashboard-kpi', { signal: controller.signal })
      clearTimeout(timeoutId)
      const text = await res.text()
      const data = text
        ? (JSON.parse(text) as Partial<AdminDashboardKpi> & { ok?: boolean; error?: string })
        : {}
      if (!res.ok || data.ok !== true) {
        setState({
          status: 'error',
          message:
            res.status === 401
              ? '로그인이 필요합니다.'
              : data.error === 'query_failed'
                ? 'KPI를 불러오지 못했습니다. 다시 시도해 주세요.'
                : 'KPI를 불러오지 못했습니다.',
        })
        return
      }
      const kpi: AdminDashboardKpi = {
        pendingCount: Number(data.pendingCount) || 0,
        registeredCount: Number(data.registeredCount) || 0,
        bookingCount: Number(data.bookingCount) || 0,
        inquiryCount: Number(data.inquiryCount) || 0,
        affiliationPendingCount: Number(data.affiliationPendingCount) || 0,
        consultIntakeTotal: Number(data.consultIntakeTotal) || 0,
      }
      setState({ status: 'ok', kpi })
      onKpi?.(kpi)
    } catch (e) {
      clearTimeout(timeoutId)
      const aborted = e instanceof Error && e.name === 'AbortError'
      setState({
        status: 'error',
        message: aborted
          ? '응답이 지연되고 있습니다. 다시 시도해 주세요.'
          : 'KPI를 불러오지 못했습니다.',
      })
    }
  }, [onKpi])

  useEffect(() => {
    void load()
  }, [load])

  const kpi = state.status === 'ok' ? state.kpi : null
  const affiliationPendingCount = kpi?.affiliationPendingCount
  const pendingCount = kpi?.pendingCount
  const registeredCount = kpi?.registeredCount
  const consultIntakeTotal = kpi?.consultIntakeTotal

  return (
    <>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <AdminKpiCard
          label="소속 명함 승인대기"
          value={state.status === 'loading' ? '…' : formatCount(affiliationPendingCount)}
          href={`/admin/bongsim/affiliation-cards${query}`}
        />
        <AdminKpiCard
          label="등록대기"
          value={state.status === 'loading' ? '…' : formatCount(pendingCount)}
          href={`/admin/pending${query}`}
        />
        <AdminKpiCard
          label="상품 목록"
          value={state.status === 'loading' ? '…' : formatCount(registeredCount)}
          href={`/admin/products${query}`}
        />
        <AdminKpiCard
          label="상담·접수"
          value={state.status === 'loading' ? '…' : formatCount(consultIntakeTotal)}
          href={`/admin/bookings${query}`}
        />
        <AdminKpiCard
          label="오늘 수집"
          value={<span className="text-base font-normal text-bt-text-muted-lavender">아래 차트 참고</span>}
          tone="muted"
        />
      </section>

      {state.status === 'error' && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{state.message}</span>
          <button type="button" className={ADMIN_BTN_SECONDARY_CLASS} onClick={() => void load()}>
            다시 시도
          </button>
        </div>
      )}

      {kpi && pendingCount === 0 && registeredCount === 0 && (
        <div className="mb-8">
          <AdminEmptyState
            title="등록대기 0건, 상품 0건"
            description="상품 등록에서 첫 상품을 추가해 보세요."
            actionLabel="상품 등록"
            actionHref={`/admin/register${query}`}
          />
        </div>
      )}
    </>
  )
}
