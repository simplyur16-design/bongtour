'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import AdminPageHeader from '@/app/admin/components/AdminPageHeader'
import { ADMIN_CARD_CLASS } from '@/lib/admin-design-system'

type CyclePayload = {
  id: string
  cycleStartDate: string
  cycleEndDate: string
  cityKeys: string[]
  fallbackKeys?: string[]
  cityLabels: Record<string, string>
}

type AheadPayload = {
  offset: number
  cycleStartDate: string
  cycleEndDate: string
  exists: boolean
  id: string | null
  cityKeys: string[]
  cityLabels: Record<string, string>
}

type StatusResponse = {
  ok: boolean
  at: string
  current: CyclePayload | null
  ahead: AheadPayload[]
  scheduleNote: string
}

function formatKstRange(startIso: string, endIso: string): string {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d)
  return `${fmt(s)} ~ ${fmt(e)}`
}

function CityChips({ keys, labels }: { keys: string[]; labels: Record<string, string> }) {
  if (keys.length === 0) return <span className="text-sm text-bt-text-muted-lavender">(없음)</span>
  return (
    <ul className="flex flex-wrap gap-2">
      {keys.map((k) => (
        <li
          key={k}
          className="rounded-full border border-bt-border-soft bg-bt-bg-lavender/60 px-3 py-1 text-sm text-bt-text-navy"
        >
          {labels[k] ?? k}
          <span className="ml-1 text-xs text-bt-text-muted-lavender">({k})</span>
        </li>
      ))}
    </ul>
  )
}

export default function SeasonCurationAdminClient() {
  const [status, setStatus] = useState<StatusResponse | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [runBusy, setRunBusy] = useState(false)
  const [runMsg, setRunMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadErr(null)
    try {
      const res = await fetch('/api/admin/season-curation', { cache: 'no-store', credentials: 'include' })
      const j = (await res.json()) as StatusResponse & { error?: string }
      if (!res.ok) throw new Error(j.error ?? `로드 실패 (${res.status})`)
      setStatus(j)
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '오류')
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function runJob(force: boolean) {
    setRunBusy(true)
    setRunMsg(null)
    try {
      const res = await fetch('/api/admin/season-curation', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })
      const j = (await res.json()) as {
        ok?: boolean
        rotated?: boolean
        cycleId?: string | null
        cityKeys?: string[]
        message?: string
        error?: string
      }
      if (!res.ok || !j.ok) {
        throw new Error(j.message ?? j.error ?? `실행 실패 (${res.status})`)
      }
      setRunMsg(
        force
          ? `강제 재생성 완료 · 사이클 ${j.cycleId ?? '-'} · 도시 ${(j.cityKeys ?? []).length}개`
          : `실행 완료 · rotated=${String(j.rotated)} · 사이클 ${j.cycleId ?? '-'}`,
      )
      await load()
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : '오류')
    } finally {
      setRunBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <AdminPageHeader
        title="시즌 추천 여행지"
        subtitle="메인「추천 여행지」5도시·해외 허브 히어로. 생성 달에는 노출하지 않고 +1·+2·+3월 여행지(5월 생성→6·7·8월)가 섞여 나갑니다. Gemini가 월별 사이클을 생성합니다."
      />

      <section className={ADMIN_CARD_CLASS}>
        <h2 className="text-lg font-semibold text-bt-text-navy">수동 실행</h2>
        <p className="mt-2 text-sm text-bt-text-muted-lavender">
          {status?.scheduleNote ??
            '서버 기동 시 1회 시드 · 매월 15일 00:00 KST 자동 갱신'}
          {' '}
          · <code className="text-xs">GEMINI_API_KEY</code> 필요
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={runBusy}
            onClick={() => void runJob(false)}
            className="rounded-lg bg-bt-text-navy px-4 py-2 text-sm font-semibold text-white hover:bg-bt-text-navy/90 disabled:opacity-50"
          >
            {runBusy ? '실행 중…' : '지금 실행 (+1~+3월 선행 포함)'}
          </button>
          <button
            type="button"
            disabled={runBusy}
            onClick={() => {
              if (!window.confirm('현재 사이클을 끝내고 새로 생성합니다. 계속할까요?')) return
              void runJob(true)
            }}
            className="rounded-lg border border-amber-500/60 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            강제 재생성
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="rounded-lg border border-bt-border-soft px-4 py-2 text-sm text-bt-text-navy hover:bg-bt-bg-lavender/80 disabled:opacity-50"
          >
            새로고침
          </button>
        </div>
        {runMsg ? <p className="mt-3 text-sm text-bt-text-navy">{runMsg}</p> : null}
      </section>

      {loadErr ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadErr}</p>
      ) : null}

      {loading && !status ? <p className="text-sm text-bt-text-muted-lavender">불러오는 중…</p> : null}

      {status?.current ? (
        <section className={ADMIN_CARD_CLASS}>
          <h2 className="text-lg font-semibold text-bt-text-navy">이번 달 활성 사이클 (생성 달)</h2>
          <p className="mt-1 text-xs text-bt-text-muted-lavender">
            {formatKstRange(status.current.cycleStartDate, status.current.cycleEndDate)}
            {' · '}
            공개 헤드라인 목표 월: +1·+2·+3월 혼합 (현재 생성 달 미노출)
          </p>
          <div className="mt-3">
            <CityChips keys={status.current.cityKeys} labels={status.current.cityLabels} />
          </div>
          <p className="mt-3 text-xs text-bt-text-muted-lavender">
            공개: <Link href="/" className="underline">메인 추천 여행지</Link>
            {' · '}
            <Link href="/travel/overseas" className="underline">해외 허브 히어로</Link>
          </p>
        </section>
      ) : status && !loading ? (
        <section className={`${ADMIN_CARD_CLASS} border-amber-200 bg-amber-50/50`}>
          <p className="text-sm text-amber-900">활성 사이클이 없습니다. 「지금 실행」을 눌러 생성하세요.</p>
        </section>
      ) : null}

      {status?.ahead?.length ? (
        <section className={ADMIN_CARD_CLASS}>
          <h2 className="text-lg font-semibold text-bt-text-navy">선행 준비 (+1 · +2 · +3월)</h2>
          <ul className="mt-4 space-y-4">
            {status.ahead.map((row) => (
              <li key={row.offset} className="rounded-lg border border-bt-border-soft/80 bg-bt-bg-lavender/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-bt-text-navy">+{row.offset}월</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.exists ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {row.exists ? '생성됨' : '미생성'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-bt-text-muted-lavender">
                  {formatKstRange(row.cycleStartDate, row.cycleEndDate)}
                </p>
                {row.exists ? (
                  <div className="mt-2">
                    <CityChips keys={row.cityKeys} labels={row.cityLabels} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </div>
  )
}
