'use client'

import { useState } from 'react'
import type { BongHookLearnConfig, BongPostInsight } from '@prisma/client'

type HookLearnConfigForm = {
  topPercentile: number
  bottomPercentile: number
  minSampleSize: number
  lookbackDays: number
  enabled: boolean
}

type SyncTickResult = {
  sync?: {
    instagram?: { synced?: number; errors?: number }
    facebook?: { synced?: number; errors?: number }
  }
  learn?: {
    learnedGood?: number
    learnedBad?: number
    skippedDuplicates?: number
    totalSampleSize?: number
  }
}

type Props = {
  initialInsights: BongPostInsight[]
  initialConfig: BongHookLearnConfig | null
  totalCount: number
}

const DEFAULT_CONFIG: HookLearnConfigForm = {
  topPercentile: 20,
  bottomPercentile: 20,
  minSampleSize: 20,
  lookbackDays: 90,
  enabled: true,
}

export default function InsightsClient({ initialInsights, initialConfig, totalCount }: Props) {
  const [insights, setInsights] = useState(initialInsights)
  const [config, setConfig] = useState<HookLearnConfigForm>(
    initialConfig
      ? {
          topPercentile: initialConfig.topPercentile,
          bottomPercentile: initialConfig.bottomPercentile,
          minSampleSize: initialConfig.minSampleSize,
          lookbackDays: initialConfig.lookbackDays,
          enabled: initialConfig.enabled,
        }
      : DEFAULT_CONFIG,
  )
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncTickResult | null>(null)

  async function handleSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/admin/marketing/insights/sync', { method: 'POST' })
      const result = (await res.json()) as SyncTickResult & { error?: string }
      if (!res.ok) throw new Error(result.error || '동기화 실패')
      setSyncResult(result)
      const listRes = await fetch('/api/admin/marketing/insights/list?limit=20')
      const listJson = (await listRes.json()) as { insights: BongPostInsight[] }
      setInsights(listJson.insights)
    } catch (err) {
      alert(`동기화 실패: ${err instanceof Error ? err.message : '알 수 없음'}`)
    } finally {
      setSyncing(false)
    }
  }

  async function handleSaveConfig() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/marketing/hook-learn-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) alert('설정이 저장되었습니다.')
      else {
        const j = (await res.json()) as { error?: string }
        alert(j.error || '저장 실패')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">인사이트 대시보드</h1>
        <p className="mt-1 text-sm text-bt-body/70">
          인스타·페북 게시물 도달·반응 지표와 후킹 자동 학습 설정
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {syncing ? '동기화 중…' : '지금 인사이트 수집'}
        </button>
        <p className="text-sm text-bt-body/70">
          총 {totalCount}개 인사이트 · cron 매일 03:00 KST 자동
        </p>
      </div>

      {syncResult && (
        <div className="rounded-lg border border-bt-border bg-bt-bg-soft p-4 text-sm">
          <p className="font-medium text-bt-title">동기화 결과</p>
          <p className="mt-1">
            인스타: {syncResult.sync?.instagram?.synced ?? 0}개 동기화,{' '}
            {syncResult.sync?.instagram?.errors ?? 0}개 실패
          </p>
          <p>
            페북: {syncResult.sync?.facebook?.synced ?? 0}개 동기화,{' '}
            {syncResult.sync?.facebook?.errors ?? 0}개 실패
          </p>
          <p className="mt-2">
            후킹 학습 — 좋은 후킹 {syncResult.learn?.learnedGood ?? 0}개, 금지 후킹{' '}
            {syncResult.learn?.learnedBad ?? 0}개 (중복 스킵{' '}
            {syncResult.learn?.skippedDuplicates ?? 0}개, 샘플{' '}
            {syncResult.learn?.totalSampleSize ?? 0}개)
          </p>
        </div>
      )}

      <section className="rounded-xl border border-bt-border-strong bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-bt-title">후킹 자동 학습 설정</h2>
        <p className="mt-1 text-sm text-bt-body/70">
          인사이트 수집 직후 도달 순위 기준으로 캡션 헤드라인을 후킹 라이브러리에 등록합니다.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-bt-body">상위 N% → 모범 후킹</span>
            <input
              type="number"
              min={1}
              max={50}
              value={config.topPercentile}
              onChange={(e) =>
                setConfig({ ...config, topPercentile: Number.parseInt(e.target.value, 10) || 20 })
              }
              className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-bt-body">하위 N% → 금지 후킹</span>
            <input
              type="number"
              min={1}
              max={50}
              value={config.bottomPercentile}
              onChange={(e) =>
                setConfig({
                  ...config,
                  bottomPercentile: Number.parseInt(e.target.value, 10) || 20,
                })
              }
              className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-bt-body">최소 샘플 크기</span>
            <input
              type="number"
              min={5}
              value={config.minSampleSize}
              onChange={(e) =>
                setConfig({ ...config, minSampleSize: Number.parseInt(e.target.value, 10) || 20 })
              }
              className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="text-bt-body">조회 기간 (일)</span>
            <input
              type="number"
              min={7}
              value={config.lookbackDays}
              onChange={(e) =>
                setConfig({ ...config, lookbackDays: Number.parseInt(e.target.value, 10) || 90 })
              }
              className="mt-1 w-full rounded-lg border border-bt-border px-3 py-2"
            />
          </label>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
          />
          자동 학습 활성화
        </label>

        <button
          type="button"
          onClick={handleSaveConfig}
          disabled={saving}
          className="mt-4 rounded-lg bg-bt-brand-blue px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? '저장 중…' : '설정 저장'}
        </button>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-bt-title">상위 도달 게시물 TOP 20</h2>

        {insights.length === 0 && (
          <p className="mt-3 text-sm text-bt-body/70">
            아직 인사이트 데이터가 없습니다. Meta 연결 후 [지금 인사이트 수집]을 실행하세요.
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {insights.map((insight) => (
            <li
              key={insight.id}
              className="rounded-xl border border-bt-border-strong bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-bt-title">
                    {insight.caption?.split('\n')[0]?.slice(0, 80) || '(캡션 없음)'}
                  </p>
                  <p className="mt-1 text-xs text-bt-body/60">
                    {insight.publishedAt
                      ? new Date(insight.publishedAt).toLocaleDateString('ko-KR')
                      : '—'}
                    {' · '}
                    {insight.sourceType === 'instagram-organic' ? '인스타' : '페북'}
                  </p>
                </div>
                <div className="shrink-0 text-right text-sm">
                  <p>
                    도달 <strong>{insight.reach?.toLocaleString() ?? '-'}</strong>
                  </p>
                  <p className="text-bt-body/70">
                    좋아요 {insight.likes ?? '-'} · 저장 {insight.saved ?? '-'}
                  </p>
                </div>
              </div>
              {insight.permalink && (
                <a
                  href={insight.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-bt-brand-blue hover:underline"
                >
                  게시물 보기 →
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
