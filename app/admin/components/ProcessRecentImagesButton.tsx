'use client'

import { useState } from 'react'

export default function ProcessRecentImagesButton() {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleRun = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/process-images/recent', { method: 'GET' })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { ok?: boolean; message?: string; processed?: number; error?: string }) : {}
      if (data.ok) {
        setMessage(data.processed ? `${data.message ?? ''}` : (data.message ?? '처리 완료'))
      } else {
        setMessage(data.error ?? '실패')
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
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
      >
        {loading ? '처리 중…' : '지금 최근 1시간 상품 이미지 생성'}
      </button>
      {message && <p className="text-sm text-gray-600">{message}</p>}
    </div>
  )
}
