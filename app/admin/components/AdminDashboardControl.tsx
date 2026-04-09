'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import AdminLogTerminal from './AdminLogTerminal'
import ScraperStatusIndicator from './ScraperStatusIndicator'

type TodayStats = { success: number; fail: number }

const CHART_DATA = (stats: TodayStats) => [
  { name: '성공', count: stats.success, fill: '#22c55e' },
  { name: '실패', count: stats.fail, fill: '#ef4444' },
]

/**
 * 대시보드 하단: 오늘 수집 현황 · 봇 상태 · 가격 동기화 1회 · 로그.
 * 기존 /admin/control 내용을 대시보드에 포함하기 위한 클라이언트 블록.
 */
export default function AdminDashboardControl() {
  const [stats, setStats] = useState<TodayStats>({ success: 0, fail: 0 })
  const [loading, setLoading] = useState(true)
  const [runLoading, setRunLoading] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats/today')
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { success?: number; fail?: number }) : {}
      if (res.ok) setStats({ success: data.success ?? 0, fail: data.fail ?? 0 })
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const t = setInterval(fetchStats, 60000)
    return () => clearInterval(t)
  }, [fetchStats])

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

  return (
    <section className="mt-10 border-t border-gray-200 pt-8">
      <h2 className="mb-4 border-l-4 border-slate-600 pl-4 text-lg font-bold text-[#0f172a]">
        오늘 수집 현황 · 봇 상태
      </h2>
      <div className="shrink-0 pb-4">
        <ScraperStatusIndicator />
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          오늘 수집 현황
        </h3>
        {loading ? (
          <div className="flex h-32 items-center justify-center text-gray-500">로딩 중…</div>
        ) : (
          <div className="flex flex-wrap items-end gap-6">
            <div className="h-32 w-full min-w-0 max-w-xs">
              <ResponsiveContainer width="100%" height={128} minWidth={0}>
                <BarChart data={CHART_DATA(stats)} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0' }}
                    labelStyle={{ color: '#0f172a' }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {CHART_DATA(stats).map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex shrink-0 gap-6 text-sm">
              <div>
                <span className="text-gray-500">성공</span>
                <p className="text-lg font-semibold text-emerald-600">{stats.success}</p>
              </div>
              <div>
                <span className="text-gray-500">실패</span>
                <p className="text-lg font-semibold text-red-600">{stats.fail}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="mt-6 min-h-[280px]">
        <AdminLogTerminal onRunWithStream={handleRunWithStream} runLoading={runLoading} />
      </div>
    </section>
  )
}
