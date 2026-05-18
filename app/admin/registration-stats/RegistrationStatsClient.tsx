'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_CARD_CLASS } from '@/lib/admin-design-system'

type Payload = {
  ok: boolean
  totals: { total: number; registered: number }
  suppliers: Array<{
    originSource: string
    total: number
    registered: number
    pending: number
    onHold: number
    rejected: number
    autoUnpublished: number
  }>
  countries: Array<{ countryKey: string; koreanLabel: string; registeredCount: number }>
  cities: Array<{
    cityKey: string
    koreanLabel: string
    countryKey: string | null
    countryLabel: string | null
    registeredCount: number
  }>
}

type CalendarAudit = {
  ok: boolean
  environment: { nodeEnv: string; cronRegistered: boolean; bearerConfigured: boolean }
  strategy: {
    shouldRunToday: boolean
    mode: string
    dateRangeStartYmd?: string
    dateRangeEndYmd?: string
  }
  counts: {
    registeredProducts: number
    registeredWithFutureDepartures: number
    departuresUpdatedLast7Days: number
  }
  scheduleNote: string
  issues: string[]
}

export default function RegistrationStatsClient() {
  const [data, setData] = useState<Payload | null>(null)
  const [audit, setAudit] = useState<CalendarAudit | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const [r1, r2] = await Promise.all([
        fetch('/api/admin/stats/registration', { cache: 'no-store', credentials: 'include' }),
        fetch('/api/admin/scheduler/calendar-audit', { cache: 'no-store', credentials: 'include' }),
      ])
      const j1 = (await r1.json()) as Payload & { error?: string }
      const j2 = (await r2.json()) as CalendarAudit & { error?: string }
      if (!r1.ok) throw new Error(j1.error ?? `등록 통계 (${r1.status})`)
      if (!r2.ok) throw new Error(j2.error ?? `캘린더 점검 (${r2.status})`)
      setData(j1)
      setAudit(j2)
    } catch (e) {
      setErr(e instanceof Error ? e.message : '오류')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <AdminPageHeader
        title="등록 현황 · 요금 수집 점검"
        subtitle="해외 상품의 여행사·국가·도시별 등록 수와 날짜별 요금(출발일) 자동 수집 상태를 확인합니다."
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="rounded-lg border border-bt-border-soft px-3 py-2 text-sm hover:bg-white disabled:opacity-50"
        >
          새로고침
        </button>
        <Link
          href="/admin/scheduler-settings"
          className="rounded-lg bg-bt-text-navy px-3 py-2 text-sm font-semibold text-white hover:bg-bt-text-navy/90"
        >
          스케줄러 설정 →
        </Link>
      </div>
      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {loading && !data ? <p className="text-sm text-bt-text-muted-lavender">불러오는 중…</p> : null}

      {audit ? (
        <section className={ADMIN_CARD_CLASS}>
          <h2 className="text-lg font-semibold text-bt-text-navy">날짜별 요금 자동 수집</h2>
          <p className="mt-2 text-sm text-bt-text-muted-lavender">{audit.scheduleNote}</p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-bt-text-muted-lavender">환경</dt>
              <dd className="font-medium">{audit.environment.nodeEnv}</dd>
            </div>
            <div>
              <dt className="text-bt-text-muted-lavender">자동 크론 등록</dt>
              <dd className="font-medium">{audit.environment.cronRegistered ? '예 (운영)' : '아니오'}</dd>
            </div>
            <div>
              <dt className="text-bt-text-muted-lavender">오늘 배치 실행</dt>
              <dd className="font-medium">{audit.strategy.shouldRunToday ? '예' : '아니오'}</dd>
            </div>
            <div>
              <dt className="text-bt-text-muted-lavender">모드</dt>
              <dd className="font-medium">
                {audit.strategy.mode}
                {audit.strategy.dateRangeStartYmd
                  ? ` (${audit.strategy.dateRangeStartYmd}~${audit.strategy.dateRangeEndYmd ?? ''})`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-bt-text-muted-lavender">등록 상품</dt>
              <dd className="font-medium">{audit.counts.registeredProducts.toLocaleString('ko-KR')}건</dd>
            </div>
            <div>
              <dt className="text-bt-text-muted-lavender">미래 출발일 보유</dt>
              <dd className="font-medium">
                {audit.counts.registeredWithFutureDepartures.toLocaleString('ko-KR')}건
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-bt-text-muted-lavender">최근 7일 ProductDeparture 갱신</dt>
              <dd className="font-medium">{audit.counts.departuresUpdatedLast7Days.toLocaleString('ko-KR')}행</dd>
            </div>
          </dl>
          {audit.issues.length > 0 ? (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {audit.issues.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-emerald-800">점검 항목상 자동 수집 경로에 큰 차단 요소는 없습니다.</p>
          )}
        </section>
      ) : null}

      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2">
            <div className={ADMIN_CARD_CLASS}>
              <p className="text-sm text-bt-text-muted-lavender">해외 상품 전체</p>
              <p className="mt-1 text-2xl font-bold text-bt-text-navy">{data.totals.total.toLocaleString('ko-KR')}</p>
            </div>
            <div className={ADMIN_CARD_CLASS}>
              <p className="text-sm text-bt-text-muted-lavender">등록됨 (registered)</p>
              <p className="mt-1 text-2xl font-bold text-bt-text-navy">
                {data.totals.registered.toLocaleString('ko-KR')}
              </p>
            </div>
          </section>

          <section className={ADMIN_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-bt-text-navy">여행사별 등록 현황</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-bt-text-muted-lavender">
                    <th className="px-2 py-2">originSource</th>
                    <th className="px-2 py-2">등록</th>
                    <th className="px-2 py-2">대기</th>
                    <th className="px-2 py-2">보류</th>
                    <th className="px-2 py-2">반려</th>
                    <th className="px-2 py-2">전체</th>
                  </tr>
                </thead>
                <tbody>
                  {data.suppliers.map((r) => (
                    <tr key={r.originSource} className="border-b border-bt-border-soft/60">
                      <td className="px-2 py-2 font-mono text-xs">{r.originSource}</td>
                      <td className="px-2 py-2 font-semibold">{r.registered}</td>
                      <td className="px-2 py-2">{r.pending}</td>
                      <td className="px-2 py-2">{r.onHold}</td>
                      <td className="px-2 py-2">{r.rejected}</td>
                      <td className="px-2 py-2">{r.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={ADMIN_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-bt-text-navy">나라별 등록 (registered)</h2>
            <div className="mt-4 overflow-x-auto max-h-80">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-bt-text-muted-lavender">
                    <th className="px-2 py-2">나라</th>
                    <th className="px-2 py-2">countryKey</th>
                    <th className="px-2 py-2">상품 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.countries.map((r) => (
                    <tr key={r.countryKey} className="border-b border-bt-border-soft/60">
                      <td className="px-2 py-2">{r.koreanLabel}</td>
                      <td className="px-2 py-2 font-mono text-xs">{r.countryKey}</td>
                      <td className="px-2 py-2 font-semibold">{r.registeredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={ADMIN_CARD_CLASS}>
            <h2 className="text-lg font-semibold text-bt-text-navy">도시별 등록 (registered, 상위 80)</h2>
            <div className="mt-4 overflow-x-auto max-h-96">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-bt-text-muted-lavender">
                    <th className="px-2 py-2">도시</th>
                    <th className="px-2 py-2">나라</th>
                    <th className="px-2 py-2">cityKey</th>
                    <th className="px-2 py-2">상품 수</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cities.map((r) => (
                    <tr key={r.cityKey} className="border-b border-bt-border-soft/60">
                      <td className="px-2 py-2">{r.koreanLabel}</td>
                      <td className="px-2 py-2">{r.countryLabel ?? '—'}</td>
                      <td className="px-2 py-2 font-mono text-xs">{r.cityKey}</td>
                      <td className="px-2 py-2 font-semibold">{r.registeredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
