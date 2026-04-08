'use client'

import { useState, useEffect } from 'react'

type Status = { currentProductId: string | null; currentOriginCode: string | null }

export default function ScraperStatusIndicator() {
  const [status, setStatus] = useState<Status>({ currentProductId: null, currentOriginCode: null })

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/admin/scraper/status')
        const text = await res.text()
        const data = text ? (JSON.parse(text) as { currentProductId?: string | null; currentOriginCode?: string | null }) : {}
        if (res.ok)
          setStatus({
            currentProductId: data.currentProductId ?? null,
            currentOriginCode: data.currentOriginCode ?? null,
          })
      } catch {
        // ignore
      }
    }
    fetchStatus()
    const t = setInterval(fetchStatus, 2000)
    return () => clearInterval(t)
  }, [])

  const active = !!status.currentOriginCode

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-4 py-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        봇 상태
      </h2>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-3 w-3 rounded-full ${
            active ? 'animate-pulse bg-amber-400' : 'bg-slate-600'
          }`}
          aria-hidden
        />
        {active ? (
          <span className="font-mono text-sm font-medium text-slate-200">
            수집 중: <span className="text-amber-300">{status.currentOriginCode}</span>
          </span>
        ) : (
          <span className="text-sm text-slate-500">대기 중 (현재 수집 상품 없음)</span>
        )}
      </div>
    </div>
  )
}
