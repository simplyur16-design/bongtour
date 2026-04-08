'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

export default function ConvertToWebpPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [result, setResult] = useState<{
    filename?: string
    sizeBytes: number
    originalSizeBytes: number
    width: number
    height: number
    dataUrl?: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [maxWidth, setMaxWidth] = useState('1600')
  const [quality, setQuality] = useState('82')
  const [cityName, setCityName] = useState('')
  const [attractionName, setAttractionName] = useState('')
  const [source, setSource] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    setFile(f ?? null)
    setResult(null)
    setError(null)
  }

  const suggestWithGemini = async () => {
    if (!file) {
      setError('먼저 이미지 파일을 선택하세요.')
      return
    }
    setSuggesting(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/suggest-image-name', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '추천 실패')
      setCityName(data.city ?? '')
      setAttractionName(data.attraction ?? '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '제미나이 추천 실패')
    } finally {
      setSuggesting(false)
    }
  }

  const convert = async (asDownload: boolean) => {
    if (!file) {
      setError('파일을 선택하세요.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('maxWidth', maxWidth || '1600')
      form.append('quality', quality || '82')
      form.append('cityName', cityName.trim())
      form.append('attractionName', attractionName.trim())
      form.append('source', source.trim() || 'Upload')
      const url = `/api/admin/convert-to-webp${asDownload ? '?download=1' : ''}`
      const res = await fetch(url, { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error ?? `오류 ${res.status}`)
      }
      if (asDownload) {
        const blob = await res.blob()
        const originalBytes = res.headers.get('X-Original-Bytes')
        const webpBytes = res.headers.get('X-WebP-Bytes')
        const disposition = res.headers.get('Content-Disposition')
        const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i) || disposition?.match(/filename="?([^";]+)"?/i)
        const filename = match ? decodeURIComponent(match[1].trim()) : 'image.webp'
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
        setResult({
          filename,
          originalSizeBytes: originalBytes ? parseInt(originalBytes, 10) : 0,
          sizeBytes: webpBytes ? parseInt(webpBytes, 10) : 0,
          width: 0,
          height: 0,
        })
      } else {
        const data = await res.json()
        setResult({
          filename: data.filename,
          sizeBytes: data.sizeBytes,
          originalSizeBytes: data.originalSizeBytes,
          width: data.width,
          height: data.height,
          dataUrl: data.dataUrl,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '변환 실패')
    } finally {
      setLoading(false)
    }
  }

  const copyDataUrl = () => {
    if (!result?.dataUrl) return
    navigator.clipboard.writeText(result.dataUrl)
    alert('data URL을 클립보드에 복사했습니다.')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-blue-600 hover:underline">
          ← 관리자
        </Link>
        <h1 className="text-xl font-semibold">이미지 포맷 변환: JPG → WebP (파일 용량 최적화)</h1>
      </div>
      <p className="text-sm text-gray-600">
        한 장씩 WebP로 변환해 용량을 줄입니다. 도시·명소는 한글, 출처는 파일명에서 읽습니다. 네이밍: [도시명]_[명소명]_[출처].webp
      </p>

      <div className="space-y-4 rounded-lg border bg-white p-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">이미지 파일 (1장)</label>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-blue-700"
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">도시명 (한글)</label>
            <input
              type="text"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="교토, 오사카"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">명소명 (한글)</label>
            <input
              type="text"
              value={attractionName}
              onChange={(e) => setAttractionName(e.target.value)}
              placeholder="후시미 이나리, 오사카성"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">출처 (파일명에서 iStock 등)</label>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="iStock, 직접촬영"
              className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">파일명 예: 교토_후시미이나리_iStock.webp</p>
        <button
          type="button"
          onClick={suggestWithGemini}
          disabled={suggesting || !file}
          className="rounded border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm text-violet-800 disabled:opacity-50"
        >
          {suggesting ? '제미나이 분석 중…' : '제미나이로 도시·명소 추천 (한글)'}
        </button>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">최대 가로(px)</label>
            <input
              type="number"
              min="100"
              max="4000"
              value={maxWidth}
              onChange={(e) => setMaxWidth(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">품질 (1–100)</label>
            <input
              type="number"
              min="1"
              max="100"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => convert(false)}
            disabled={loading || !file}
            className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            {loading ? '변환 중…' : '변환 후 미리보기'}
          </button>
          <button
            type="button"
            onClick={() => convert(true)}
            disabled={loading || !file}
            className="rounded border border-gray-300 bg-white px-4 py-2 disabled:opacity-50"
          >
            WebP 다운로드
          </button>
        </div>
      </div>

      {result && (
        <div className="space-y-2 rounded-lg border bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-700">결과</p>
          {result.filename && <p className="text-xs text-gray-600">파일명: {result.filename}</p>}
          <p className="text-sm text-gray-600">
            원본 {Math.round(result.originalSizeBytes / 1024)}KB → WebP {Math.round(result.sizeBytes / 1024)}KB
            {result.width > 0 && ` (${result.width}×${result.height})`}
          </p>
          {result.dataUrl && (
            <>
              <img src={result.dataUrl} alt="WebP 미리보기" className="max-h-48 rounded border object-contain" />
              <button
                type="button"
                onClick={copyDataUrl}
                className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm"
              >
                data URL 복사
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
