'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import AdminPageHeader from '../components/AdminPageHeader'
import AdminLogTerminal from '../components/AdminLogTerminal'

type HanatourMonthListItem = {
  id: string
  title: string
  originCode: string
  originUrl: string | null
  detailUrl: string
  updatedAt: string
  priceStartDate: string | null
  priceEndDate: string | null
  departureRowCount: number
}

function buildHanatourMonthSelectOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = []
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 12)
  for (let i = 0; i < 48; i++) {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const value = `${y}-${String(m).padStart(2, '0')}`
    out.push({ value, label: `${y}년 ${m}월 (${value})` })
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

function defaultHanatourMonthYm(): string {
  const x = new Date()
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`
}

type HanatourMonthRunItem = {
  productId: string
  title: string
  month: string
  status: 'ok' | 'failed' | 'skipped'
  collectedCount: number
  upsertedCount: number
  error: string | null
  liveError: string | null
  elapsedMs: number
}

type SchedulerConfig = {
  cronHour: number
  cronMinute: number
  restMin: number
  restMax: number
  randomizeUserAgent: boolean
  randomMouseMovement: boolean
  headlessMode: boolean
}

type SchedulerCheckpointPayload = {
  lastCollectedDate: string | null
  lastRunAt: string | null
  lastRunMode: string | null
  lastRunStatus: string | null
  totalProductsScraped: number
  errorMessage: string | null
  currentMode?: string
  modeLabel: string
  nextRunHint: string
  progress: { coveredDaysOutOfHorizon: number; horizonDays: number }
  activeDateRange: { startYmd: string; endYmd: string }
  error?: string
}

const REST_MIN_LIMIT = 10
const REST_MAX_LIMIT = 120

const HANATOUR_MONTH_OPTIONS = buildHanatourMonthSelectOptions()

export default function AdminSchedulerSettingsPage() {
  const [config, setConfig] = useState<SchedulerConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [emergencyLoading, setEmergencyLoading] = useState(false)
  const [emergencyMessage, setEmergencyMessage] = useState<string | null>(null)

  const [cleanupGraceDays, setCleanupGraceDays] = useState(7)
  const [cleanupLoading, setCleanupLoading] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{
    dryRun: boolean
    scannedCount: number
    preservedCount: number
    deletedCount: number
    deletedFiles: string[]
  } | null>(null)
  const [cleanupError, setCleanupError] = useState<string | null>(null)

  const [runLoading, setRunLoading] = useState(false)
  const [hanatourMonth, setHanatourMonth] = useState(defaultHanatourMonthYm)
  const [hanatourLoading, setHanatourLoading] = useState(false)
  const [hanatourList, setHanatourList] = useState<HanatourMonthListItem[]>([])
  const [hanatourListLoading, setHanatourListLoading] = useState(true)
  const [hanatourListError, setHanatourListError] = useState<string | null>(null)
  const [hanatourFilter, setHanatourFilter] = useState('')
  const [selectedHanatourIds, setSelectedHanatourIds] = useState<Set<string>>(() => new Set())
  const [hanatourRunSummary, setHanatourRunSummary] = useState<{
    successCount: number
    failedCount: number
    skippedCount: number
    results: HanatourMonthRunItem[]
  } | null>(null)

  const [checkpoint, setCheckpoint] = useState<SchedulerCheckpointPayload | null>(null)
  const [checkpointLoading, setCheckpointLoading] = useState(true)
  const [checkpointError, setCheckpointError] = useState<string | null>(null)

  const fetchCheckpoint = useCallback(async () => {
    setCheckpointLoading(true)
    setCheckpointError(null)
    try {
      const res = await fetch('/api/admin/scheduler/checkpoint', { signal: AbortSignal.timeout(12000) })
      const data = (await res.json().catch(() => ({}))) as SchedulerCheckpointPayload & { error?: string }
      if (res.ok && !data.error) {
        setCheckpoint(data)
      } else {
        setCheckpoint(null)
        setCheckpointError(data.error ?? '체크포인트를 불러오지 못했습니다.')
      }
    } catch (e) {
      setCheckpoint(null)
      setCheckpointError(e instanceof Error ? e.message : '체크포인트 요청 실패')
    } finally {
      setCheckpointLoading(false)
    }
  }, [])

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setLoadingError(null)
    try {
      const res = await fetch('/api/admin/scheduler/config', { signal: AbortSignal.timeout(8000) })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as SchedulerConfig & { error?: string }) : null
      if (res.ok && data && !('error' in data)) {
        setConfig(data as SchedulerConfig)
      } else {
        setConfig(null)
        setLoadingError((data as { error?: string } | null)?.error ?? '설정을 불러오지 못했습니다.')
      }
    } catch (e) {
      setConfig(null)
      setLoadingError(e instanceof Error ? e.message : '설정을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    void fetchCheckpoint()
  }, [fetchCheckpoint])

  const fetchHanatourList = useCallback(async () => {
    setHanatourListLoading(true)
    setHanatourListError(null)
    try {
      const res = await fetch('/api/admin/scheduler/hanatour-month-departures', { signal: AbortSignal.timeout(60000) })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: HanatourMonthListItem[]
        error?: string
      }
      if (res.ok && data.ok && Array.isArray(data.items)) {
        setHanatourList(data.items)
      } else {
        setHanatourList([])
        setHanatourListError(data.error ?? '목록을 불러오지 못했습니다.')
      }
    } catch (e) {
      setHanatourList([])
      setHanatourListError(e instanceof Error ? e.message : '목록 요청 실패')
    } finally {
      setHanatourListLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHanatourList()
  }, [fetchHanatourList])

  const filteredHanatourList = useMemo(() => {
    const q = hanatourFilter.trim().toLowerCase()
    if (!q) return hanatourList
    return hanatourList.filter(
      (p) =>
        (p.title ?? '').toLowerCase().includes(q) ||
        (p.originCode ?? '').toLowerCase().includes(q) ||
        (p.detailUrl ?? '').toLowerCase().includes(q)
    )
  }, [hanatourList, hanatourFilter])

  const update = (patch: Partial<SchedulerConfig>) => {
    setConfig((c) => {
      if (!c) return null
      const next = { ...c, ...patch }
      if (patch.restMin != null && next.restMin > next.restMax) next.restMax = next.restMin
      if (patch.restMax != null && next.restMax < next.restMin) next.restMin = next.restMax
      return next
    })
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    setSaveMessage(null)
    try {
      const res = await fetch('/api/admin/scheduler/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as SchedulerConfig & { error?: string }) : {}
      if (res.ok && !('error' in data)) {
        setConfig(data as SchedulerConfig)
        setSaveMessage('설정이 저장되었습니다.')
      } else {
        setSaveMessage((data as { error?: string }).error ?? '저장 실패')
      }
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  const runCleanup = async (dryRun: boolean) => {
    setCleanupLoading(true)
    setCleanupError(null)
    setCleanupResult(null)
    try {
      const graceDays = Math.max(1, Math.min(90, cleanupGraceDays))
      const res = await fetch('/api/admin/gemini/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, graceDays }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.ok) {
        setCleanupResult({
          dryRun: !!data.dryRun,
          scannedCount: data.scannedCount ?? 0,
          preservedCount: data.preservedCount ?? 0,
          deletedCount: data.deletedCount ?? 0,
          deletedFiles: Array.isArray(data.deletedFiles) ? data.deletedFiles : [],
        })
      } else {
        setCleanupError(data?.error ?? '요청 실패')
      }
    } catch (e) {
      setCleanupError(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setCleanupLoading(false)
    }
  }

  const handleRunWithStream = async () => {
    if (runLoading) return
    setRunLoading(true)
    try {
      const res = await fetch('/api/admin/scheduler/run-once?stream=1', { method: 'POST' })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { ok?: boolean; error?: string }) : {}
      if (!data.ok) console.error(data.error ?? '실행 실패')
    } finally {
      setRunLoading(false)
    }
  }

  const toggleHanatourSelect = (id: string) => {
    setSelectedHanatourIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const selectAllVisibleHanatour = () => {
    setSelectedHanatourIds((prev) => {
      const n = new Set(prev)
      filteredHanatourList.forEach((p) => n.add(p.id))
      return n
    })
  }

  const clearVisibleHanatour = () => {
    setSelectedHanatourIds((prev) => {
      const n = new Set(prev)
      filteredHanatourList.forEach((p) => n.delete(p.id))
      return n
    })
  }

  const runHanatourMonthBatch = async () => {
    if (hanatourLoading) return
    const ym = hanatourMonth.trim()
    if (!/^\d{4}-\d{2}$/.test(ym)) {
      alert('수집할 달을 목록에서 선택하세요.')
      return
    }
    const productIds = [...selectedHanatourIds]
    if (productIds.length === 0) {
      alert('하나투어 상품을 하나 이상 선택하세요.')
      return
    }
    if (!confirm(`선택한 ${productIds.length}개 상품에 대해 ${ym} 출발만 재수집합니다. 계속할까요?`)) return
    setHanatourLoading(true)
    setHanatourRunSummary(null)
    try {
      const res = await fetch('/api/admin/scheduler/hanatour-month-departures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds, hanatourMonth: ym }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        successCount?: number
        failedCount?: number
        skippedCount?: number
        results?: HanatourMonthRunItem[]
        error?: string
      }
      if (res.ok && data.ok && Array.isArray(data.results)) {
        setHanatourRunSummary({
          successCount: data.successCount ?? 0,
          failedCount: data.failedCount ?? 0,
          skippedCount: data.skippedCount ?? 0,
          results: data.results,
        })
      } else {
        alert(data.error ?? '요청 실패')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setHanatourLoading(false)
    }
  }

  const handleEmergencyStop = async () => {
    if (!confirm('실행 중인 모든 Playwright/Chromium 프로세스를 강제 종료합니다. 계속할까요?')) return
    setEmergencyLoading(true)
    setEmergencyMessage(null)
    try {
      const res = await fetch('/api/admin/scheduler/emergency-stop', { method: 'POST' })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { ok?: boolean; error?: string }) : {}
      if (data.ok) {
        setEmergencyMessage('비상 정지 신호를 보냈습니다.')
      } else {
        setEmergencyMessage(data.error ?? '실패')
      }
    } catch (e) {
      setEmergencyMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setEmergencyLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">로딩 중…</p>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-red-600">{loadingError ?? '설정을 불러오지 못했습니다.'}</p>
          <button
            type="button"
            onClick={fetchConfig}
            className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const restMinVal = Math.max(REST_MIN_LIMIT, Math.min(REST_MAX_LIMIT, config.restMin))
  const restMaxVal = Math.max(REST_MIN_LIMIT, Math.min(REST_MAX_LIMIT, config.restMax))

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#0f172a]">← 대시보드</Link>
        </div>
        <AdminPageHeader
          title="스케줄러·보안"
          subtitle="공급사별 E2E 가격 동기화(run-once), 하나투어 지정 월 출발 재수집, 실행 시간·지연·보안·비상 정지."
        />

        <section className="mb-8 rounded-xl border border-teal-100 bg-teal-50/40 p-6 shadow-sm">
          <h2 className="mb-3 border-b border-teal-100 pb-2 text-sm font-semibold uppercase tracking-wider text-teal-900">
            달력 가격 수집 체크포인트
          </h2>
          {checkpointLoading ? (
            <p className="text-sm text-gray-600">불러오는 중…</p>
          ) : checkpointError ? (
            <p className="text-sm text-red-600">{checkpointError}</p>
          ) : checkpoint ? (
            <div className="space-y-3 text-sm text-gray-800">
              <p>
                <span className="font-medium text-gray-900">마지막 수집 날짜(달력 상한):</span>{' '}
                {checkpoint.lastCollectedDate ?? '—'}
              </p>
              <p>
                <span className="font-medium text-gray-900">마지막 실행:</span>{' '}
                {checkpoint.lastRunAt
                  ? new Date(checkpoint.lastRunAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
                  : '—'}
              </p>
              <p>
                <span className="font-medium text-gray-900">모드:</span> {checkpoint.modeLabel}
              </p>
              <p>
                <span className="font-medium text-gray-900">다음 자동 실행:</span> {checkpoint.nextRunHint}
              </p>
              <p className="text-xs text-gray-600">
                현재 배치 구간: {checkpoint.activeDateRange.startYmd} ~ {checkpoint.activeDateRange.endYmd} (수동
                run-once 시 자동 결정과 동일 기준)
              </p>
              <div>
                <div className="mb-1 flex justify-between text-xs text-gray-600">
                  <span>오늘 기준 확보 일수</span>
                  <span>
                    {checkpoint.progress.coveredDaysOutOfHorizon} / {checkpoint.progress.horizonDays}일
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-teal-600 transition-[width]"
                    style={{
                      width: `${Math.min(100, Math.round((checkpoint.progress.coveredDaysOutOfHorizon / checkpoint.progress.horizonDays) * 100))}%`,
                    }}
                  />
                </div>
              </div>
              {checkpoint.lastRunStatus ? (
                <p className="text-xs text-gray-600">
                  직전 상태: <span className="font-mono">{checkpoint.lastRunStatus}</span>
                  {checkpoint.totalProductsScraped != null ? ` · 상품 처리 ${checkpoint.totalProductsScraped}건` : null}
                </p>
              ) : null}
              {checkpoint.errorMessage ? (
                <p className="text-xs text-red-700">오류: {checkpoint.errorMessage}</p>
              ) : null}
              <button
                type="button"
                onClick={() => void fetchCheckpoint()}
                className="mt-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
              >
                새로고침
              </button>
            </div>
          ) : null}
        </section>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold uppercase tracking-wider text-gray-600">
            운영 실행
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Python <code className="rounded bg-gray-100 px-1">calendar_price_scheduler --once</code> — 상품 목록을
            공급사 E2E로 순회해 달력 가격을 수집하고 <code className="rounded bg-gray-100 px-1">calendar-prices</code>
            로 반영합니다. 실시간 로그는 아래 터미널에서 확인하세요.
          </p>
          <div className="min-h-[280px]">
            <AdminLogTerminal onRunWithStream={handleRunWithStream} runLoading={runLoading} />
          </div>
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
              하나투어 전용 · 상품 선택 후 지정 월 출발 재수집
            </h3>
            <p className="mb-3 text-xs text-gray-500">
              등록완료·상품코드 보유·하나투어만 목록에 표시됩니다. 상세 페이지의 지정 월 수집(
              <code className="rounded bg-gray-100 px-1">POST …/departures?hanatourMonth=</code>)과 동일 코어입니다.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={hanatourFilter}
                onChange={(e) => setHanatourFilter(e.target.value)}
                placeholder="상품명·코드·URL 검색"
                className="min-w-[200px] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
              />
              <button
                type="button"
                onClick={() => fetchHanatourList()}
                disabled={hanatourListLoading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {hanatourListLoading ? '불러오는 중…' : '목록 새로고침'}
              </button>
            </div>
            {hanatourListError && (
              <p className="mb-2 text-sm text-red-600">{hanatourListError}</p>
            )}
            <div className="mb-3 max-h-72 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[960px] border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-gray-100 text-gray-600">
                  <tr>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">선택</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">상품명</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">코드</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">가격 시작일</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">마지막일</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">출발 건수</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">상세 URL</th>
                    <th className="border-b border-gray-200 px-2 py-2 font-medium">갱신</th>
                  </tr>
                </thead>
                <tbody>
                  {hanatourListLoading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                        목록 로딩…
                      </td>
                    </tr>
                  ) : filteredHanatourList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                        표시할 하나투어 상품이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredHanatourList.map((p) => {
                      const rows = p.departureRowCount ?? 0
                      const hasRange = rows > 0 && p.priceStartDate && p.priceEndDate
                      return (
                        <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                          <td className="px-2 py-1.5 align-top">
                            <input
                              type="checkbox"
                              checked={selectedHanatourIds.has(p.id)}
                              onChange={() => toggleHanatourSelect(p.id)}
                              className="rounded border-gray-300"
                            />
                          </td>
                          <td className="max-w-[200px] px-2 py-1.5 align-top text-[#0f172a]">
                            <span className="line-clamp-2">{p.title}</span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 align-top font-mono text-[11px]">
                            {p.originCode}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 align-top text-gray-800">
                            {hasRange ? p.priceStartDate : '미수집'}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 align-top text-gray-800">
                            {hasRange ? p.priceEndDate : '미수집'}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 align-top text-gray-600">{rows}</td>
                          <td className="max-w-[200px] px-2 py-1.5 align-top">
                            <a
                              href={p.detailUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="line-clamp-2 break-all text-blue-700 underline"
                            >
                              {p.detailUrl}
                            </a>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 align-top text-gray-500">
                            {p.updatedAt.slice(0, 10)}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllVisibleHanatour}
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                보이는 항목 전체 선택
              </button>
              <button
                type="button"
                onClick={clearVisibleHanatour}
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                보이는 항목 선택 해제
              </button>
              <span className="text-gray-500">
                선택 {selectedHanatourIds.size}건 · 표시 {filteredHanatourList.length}/
                {hanatourList.length}건
              </span>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex min-w-[220px] flex-col gap-1">
                <span className="text-xs font-medium text-gray-600">수집할 달 (스크롤 선택)</span>
                <select
                  value={hanatourMonth}
                  onChange={(e) => setHanatourMonth(e.target.value)}
                  size={8}
                  className="w-full max-w-sm rounded-lg border border-gray-300 bg-white px-2 py-1 font-mono text-sm text-[#0f172a]"
                >
                  {HANATOUR_MONTH_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={runHanatourMonthBatch}
                disabled={hanatourLoading}
                className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {hanatourLoading ? '실행 중…' : '선택 상품 해당 달 수집'}
              </button>
            </div>
            {hanatourRunSummary && (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm">
                <p className="mb-2 font-medium text-[#0f172a]">
                  결과 — 성공 {hanatourRunSummary.successCount} · 실패 {hanatourRunSummary.failedCount} · 건너뜀{' '}
                  {hanatourRunSummary.skippedCount}
                </p>
                <div className="max-h-64 overflow-auto rounded border border-gray-200 bg-white">
                  <table className="w-full border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 bg-slate-100">
                      <tr>
                        <th className="border-b px-2 py-1.5">상태</th>
                        <th className="border-b px-2 py-1.5">상품ID</th>
                        <th className="border-b px-2 py-1.5">상품명</th>
                        <th className="border-b px-2 py-1.5">선택 월</th>
                        <th className="border-b px-2 py-1.5">수집</th>
                        <th className="border-b px-2 py-1.5">반영</th>
                        <th className="border-b px-2 py-1.5">ms</th>
                        <th className="border-b px-2 py-1.5">오류</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hanatourRunSummary.results.map((r) => (
                        <tr key={r.productId} className="border-b border-gray-100">
                          <td className="px-2 py-1 font-mono">{r.status}</td>
                          <td className="max-w-[100px] truncate px-2 py-1 font-mono text-[10px] text-gray-600" title={r.productId}>
                            {r.productId}
                          </td>
                          <td className="max-w-[160px] px-2 py-1">
                            <span className="line-clamp-2">{r.title}</span>
                          </td>
                          <td className="whitespace-nowrap px-2 py-1 font-mono">{r.month}</td>
                          <td className="px-2 py-1">{r.collectedCount}</td>
                          <td className="px-2 py-1">{r.upsertedCount}</td>
                          <td className="px-2 py-1">{r.elapsedMs}</td>
                          <td className="max-w-[220px] px-2 py-1 text-red-700">
                            {[r.error, r.liveError].filter(Boolean).join(' · ') || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 실행 설정 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold uppercase tracking-wider text-gray-600">
            실행 설정
          </h2>
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">Cron 실행 시간</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={config.cronHour}
                  onChange={(e) => update({ cronHour: parseInt(e.target.value, 10) || 0 })}
                  className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
                />
                <span className="text-gray-500">시</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={config.cronMinute}
                  onChange={(e) => update({ cronMinute: parseInt(e.target.value, 10) || 0 })}
                  className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#0f172a]"
                />
                <span className="text-gray-500">분</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                매일 이 시간에 자동 수집이 실행됩니다. (대시보드 run-once에는 미적용)
              </p>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">상품 간 지연 — min (초)</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={REST_MIN_LIMIT}
                  max={REST_MAX_LIMIT}
                  value={restMinVal}
                  onChange={(e) => update({ restMin: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-[#0f172a]"
                />
                <span className="w-12 text-right font-mono text-sm text-gray-700">{restMinVal}</span>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-gray-600">상품 간 지연 — max (초)</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={REST_MIN_LIMIT}
                  max={REST_MAX_LIMIT}
                  value={restMaxVal}
                  onChange={(e) => update({ restMax: parseInt(e.target.value, 10) })}
                  className="flex-1 accent-[#0f172a]"
                />
                <span className="w-12 text-right font-mono text-sm text-gray-700">{restMaxVal}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                30~90초 권장. 상품 처리 후 이 구간에서 랜덤 대기.
              </p>
            </div>
          </div>
        </section>

        {/* 보안 설정 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold uppercase tracking-wider text-gray-600">
            보안 설정
          </h2>
          <div className="space-y-4">
            <ToggleRow
              label="Randomize User-Agent"
              checked={config.randomizeUserAgent}
              onChange={(v) => update({ randomizeUserAgent: v })}
            />
            <ToggleRow
              label="Random Mouse Movement"
              checked={config.randomMouseMovement}
              onChange={(v) => update({ randomMouseMovement: v })}
            />
            <ToggleRow
              label="Headless Mode"
              checked={config.headlessMode}
              onChange={(v) => update({ headlessMode: v })}
            />
          </div>
        </section>

        {/* 액션: 저장 */}
        <div className="mb-8 flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
          >
            {saving ? '저장 중…' : '설정 저장'}
          </button>
          {saveMessage && <span className="text-sm text-gray-600">{saveMessage}</span>}
        </div>

        {/* 파일 정리: Gemini 미사용 파일 */}
        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 border-b border-gray-100 pb-2 text-sm font-semibold uppercase tracking-wider text-gray-600">
            파일 정리
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            <code className="rounded bg-gray-100 px-1 py-0.5">public/uploads/gemini</code> 아래 참조되지 않고 유예기간이 지난 파일만 삭제합니다. Product.bgImageUrl에 연결된 파일은 삭제되지 않습니다.
          </p>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">유예기간 (일)</span>
              <input
                type="number"
                min={1}
                max={90}
                value={cleanupGraceDays}
                onChange={(e) => setCleanupGraceDays(Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 7)))}
                className="w-16 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-[#0f172a]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => runCleanup(true)}
                disabled={cleanupLoading}
                className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              >
                {cleanupLoading ? '확인 중…' : '삭제 예정 확인 (dry-run)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cleanupResult?.dryRun && cleanupResult.deletedCount > 0) {
                    if (!confirm(`삭제 예정 파일 ${cleanupResult.deletedCount}개를 실제로 삭제합니다. 계속할까요?`)) return
                  } else if (!confirm('실제로 미사용 파일을 삭제합니다. 먼저 "삭제 예정 확인"으로 대상 개수를 확인하는 것을 권장합니다. 계속할까요?')) return
                  runCleanup(false)
                }}
                disabled={cleanupLoading}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {cleanupLoading ? '실행 중…' : '실제 정리 실행'}
              </button>
            </div>
          </div>
          {cleanupError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {cleanupError}
            </div>
          )}
          {cleanupResult && (
            <div
              className={`rounded-lg border p-4 text-sm ${
                cleanupResult.dryRun
                  ? 'border-amber-200 bg-amber-50/50 text-amber-900'
                  : 'border-gray-200 bg-gray-50 text-gray-800'
              }`}
            >
              <p className="mb-2 font-medium">
                {cleanupResult.dryRun
                  ? `삭제 예정 파일 ${cleanupResult.deletedCount}개`
                  : `삭제 완료 ${cleanupResult.deletedCount}개`}
              </p>
              <ul className="mb-2 list-inside list-disc text-xs text-gray-600">
                <li>스캔: {cleanupResult.scannedCount}개</li>
                <li>보존(참조 중/유예 내): {cleanupResult.preservedCount}개</li>
                <li>삭제 {cleanupResult.dryRun ? '예정' : '완료'}: {cleanupResult.deletedCount}개</li>
              </ul>
              {cleanupResult.deletedFiles.length > 0 && (
                <div className="mt-2">
                  <p className="mb-1 text-xs font-medium text-gray-600">파일 목록 (최대 10개)</p>
                  <ul className="max-h-32 overflow-y-auto rounded border border-gray-200 bg-white p-2 font-mono text-[10px] text-gray-600">
                    {cleanupResult.deletedFiles.slice(0, 10).map((f) => (
                      <li key={f} className="truncate">
                        {f}
                      </li>
                    ))}
                    {cleanupResult.deletedFiles.length > 10 && (
                      <li className="text-gray-500">… 외 {cleanupResult.deletedFiles.length - 10}개</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 비상 정지 */}
        <section className="rounded-xl border border-red-200 bg-red-50/50 p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-red-700">
            비상 정지
          </h2>
          <p className="mb-4 text-xs text-gray-600">
            실행 중인 모든 수집 봇(Playwright/Chromium) 프로세스를 강제 종료합니다.
          </p>
          <button
            type="button"
            onClick={handleEmergencyStop}
            disabled={emergencyLoading}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
          >
            {emergencyLoading ? '처리 중…' : '비상 정지'}
          </button>
          {emergencyMessage && (
            <p className="mt-2 text-sm text-gray-600">{emergencyMessage}</p>
          )}
        </section>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-[#0f172a]' : 'bg-gray-300'
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-7' : 'left-1'
          }`}
        />
      </button>
    </div>
  )
}
