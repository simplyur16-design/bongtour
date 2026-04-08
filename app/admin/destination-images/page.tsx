'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type DestinationImageSetRow = {
  id: string
  destinationName: string
  mainImageUrl: string | null
  mainImageSource: string | null
  scheduleImageUrls: string | null
  updatedAt: string
}

export default function AdminDestinationImagesPage() {
  const [list, setList] = useState<DestinationImageSetRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [poolApplying, setPoolApplying] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [destinationName, setDestinationName] = useState('')
  const [mainImageUrl, setMainImageUrl] = useState('')
  const [scheduleUrls, setScheduleUrls] = useState<string[]>(['', '', '', ''])

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/destination-image-sets')
      const text = await res.text()
      const data = text ? (JSON.parse(text) as unknown) : []
      if (res.ok) setList(Array.isArray(data) ? data : [])
      else setList([])
    } catch {
      setList([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  const applyFromPool = async () => {
    setPoolApplying(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/destination-image-sets/from-pool', { method: 'POST' })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { message?: string; updated?: unknown[]; error?: string }) : {}
      if (res.ok) {
        setMessage(data?.message ?? `목적지 이미지 ${data?.updated?.length ?? 0}개 적용됨`)
        fetchList()
      } else {
        setMessage(data?.error ?? '일괄 적용 실패')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '일괄 적용 실패')
    } finally {
      setPoolApplying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const name = destinationName.trim()
    if (!name) {
      setMessage('목적지명을 입력하세요.')
      return
    }
    if (!mainImageUrl.trim().startsWith('http')) {
      setMessage('메인 이미지 URL을 입력하세요.')
      return
    }
    const urls = scheduleUrls.map((s) => s.trim()).filter((s) => s.startsWith('http'))
    if (urls.length < 4) {
      setMessage('일정용 이미지 URL 4개를 입력하세요.')
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/destination-image-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destinationName: name,
          mainImageUrl: mainImageUrl.trim(),
          mainImageSource: { source: 'Pexels', photographer: 'Pexels', originalLink: 'https://www.pexels.com' },
          scheduleImageUrls: urls.slice(0, 4).map((url) => ({ url })),
        }),
      })
      const text = await res.text()
      const data = text ? (JSON.parse(text) as { error?: string }) : {}
      if (res.ok) {
        setMessage(`저장됨: ${name}`)
        setDestinationName('')
        setMainImageUrl('')
        setScheduleUrls(['', '', '', ''])
        fetchList()
      } else {
        setMessage(data?.error ?? '저장 실패')
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-blue-600 hover:underline">
          ← 관리자
        </Link>
        <h1 className="text-xl font-semibold">목적지별 미리 저장 이미지</h1>
      </div>
      <p className="text-sm text-gray-600">
        여기서 등록한 도시는 상품 등록 시 Pexels 자동생성을 쓰지 않고 이 세트를 사용합니다. 메인 1장 + 일정용 4장(순서대로) URL을 넣거나, 아래에서 풀에 들어 있는 사진으로 한 번에 채울 수 있습니다.
      </p>

      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-green-800">풀 사진으로 일괄 적용</h2>
        <p className="mb-3 text-xs text-green-700">
          사진넣기(풀)에 저장된 사진을 도시별로 5장 이상 있으면 자동으로 이 목적지 이미지 세트로 채웁니다. (메인 1장 + 일정 4장, 이미 WebP로 저장된 파일 사용)
        </p>
        <button
          type="button"
          onClick={applyFromPool}
          disabled={poolApplying}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {poolApplying ? '적용 중…' : '풀에 있는 사진 쭉 로드 → 목적지 이미지로 적용'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border bg-white p-4 shadow">
        <div>
          <label className="block text-sm font-medium text-gray-700">목적지명 (도시/국가)</label>
          <input
            type="text"
            value={destinationName}
            onChange={(e) => setDestinationName(e.target.value)}
            placeholder="예: 오사카, 다낭, 도쿄"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">메인 이미지 URL (1장)</label>
          <input
            type="url"
            value={mainImageUrl}
            onChange={(e) => setMainImageUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">일정용 이미지 URL (4장 순서)</label>
          {[0, 1, 2, 3].map((i) => (
            <input
              key={i}
              type="url"
              value={scheduleUrls[i] ?? ''}
              onChange={(e) => {
                const next = [...scheduleUrls]
                next[i] = e.target.value
                setScheduleUrls(next)
              }}
              placeholder={`일정 ${i + 1}장 URL`}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          ))}
        </div>
        {message && <p className={message.startsWith('저장됨') || message.includes('적용') ? 'text-green-600' : 'text-red-600'}>{message}</p>}
        <button type="submit" disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50">
          {saving ? '저장 중…' : '저장'}
        </button>
      </form>

      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-700">등록된 세트 ({list.length})</h2>
        {loading ? (
          <p className="text-sm text-gray-500">로딩 중…</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-gray-500">없음. 위 폼으로 추가하세요.</p>
        ) : (
          <ul className="space-y-2">
            {list.map((row) => (
              <li key={row.id} className="flex items-center gap-2 rounded border bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium">{row.destinationName}</span>
                <span className="text-gray-500">· 메인 + 4장</span>
                <span className="text-gray-400">{new Date(row.updatedAt).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
