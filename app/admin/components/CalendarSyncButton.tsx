'use client'

import { useState } from 'react'

export default function CalendarSyncButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleRun = async () => {
    if (loading) return
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/scheduler/run-once', { method: 'POST' })
      const text = await res.text()
      let data: { ok?: boolean; message?: string; error?: string } = {}
      try {
        data = text ? (JSON.parse(text) as { ok?: boolean; message?: string; error?: string }) : {}
      } catch {
        // empty or invalid JSON
      }
      if (res.ok && data.ok) {
        setMessage(data.message ?? '실행 요청됨.')
      } else {
        setMessage(data.error ?? (res.status === 409 || res.status === 429 ? '실행 제한' : '실행 실패'))
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleRun}
        disabled={loading}
        className="rounded bg-[#0f172a] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e293b] disabled:opacity-50"
      >
        {loading ? '요청 중…' : '가격 동기화 지금 실행'}
      </button>
      {message && (
        <p className="text-sm text-gray-600">{message}</p>
      )}
    </div>
  )
}
