'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import Link from 'next/link'
import { resizeImageFileForUpload } from '@/lib/browser-resize-image-for-upload'

const MAX_FILES = 50
const RESIZE_MAX_WIDTH = 1200
const RESIZE_QUALITY = 0.82

/** 용량 줄이기: 브라우저에서 리사이즈 후 업로드 (서버/제미나이 부담 감소) */
type PoolItem = {
  id: string
  cityName: string
  attractionName: string
  source: string
  filePath: string
  sortOrder: number
  createdAt: string
}

export default function AdminPhotoPoolPage() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [cityNames, setCityNames] = useState('')
  const [attractionNames, setAttractionNames] = useState('')
  const [source, setSource] = useState('')
  const [list, setList] = useState<PoolItem[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [filterCity, setFilterCity] = useState('')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [batchSaving, setBatchSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const lastOrderRef = useRef<PoolItem[]>([])
  const uploadInProgressRef = useRef(false)

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const url = filterCity ? `/api/admin/photo-pool?city=${encodeURIComponent(filterCity)}` : '/api/admin/photo-pool'
      const res = await fetch(url)
      const data = await res.json()
      setList(Array.isArray(data) ? data : [])
    } finally {
      setListLoading(false)
    }
  }, [filterCity])

  useEffect(() => {
    loadList()
  }, [loadList])

  const [isDragOver, setIsDragOver] = useState(false)

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.types.includes('Files')) setIsDragOver(true)
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const items = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
    setFiles((prev) => [...prev, ...items].slice(0, MAX_FILES))
    setMessage(null)
  }, [])

  const onFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const items = Array.from(e.target.files ?? [])
    setFiles((prev) => [...prev, ...items].slice(0, MAX_FILES))
    setMessage(null)
  }, [])

  const suggestWithGemini = useCallback(async () => {
    const first = files[0]
    if (!first || !first.type.startsWith('image/')) {
      setMessage('먼저 사진을 넣어 주세요.')
      return
    }
    setSuggesting(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', first)
      const res = await fetch('/api/admin/suggest-image-name', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '추천 실패')
      setCityNames(data.city ?? '')
      setAttractionNames(data.attraction ?? '')
      setMessage('제미나이가 첫 번째 사진을 보고 도시·명소(한글)를 추천했습니다.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '제미나이 추천 실패')
    } finally {
      setSuggesting(false)
    }
  }, [files])

  /** 드래그한 사진 전부 한 번에: 용량 줄인 뒤 10장씩 나눠 전송 (요청 크기 제한 회피) → 저장 */
  const BATCH_CHUNK_SIZE = 10
  const batchSaveWithSuggest = useCallback(async () => {
    if (files.length === 0) {
      setMessage('사진을 넣거나 드래그하세요.')
      return
    }
    if (uploadInProgressRef.current) return
    uploadInProgressRef.current = true
    setBatchSaving(true)
    setMessage(null)
    try {
      setMessage(`용량 줄이는 중… (최대 ${RESIZE_MAX_WIDTH}px)`)
      const resized = await Promise.all(
        files.map((f) => resizeImageFileForUpload(f, RESIZE_MAX_WIDTH, RESIZE_QUALITY))
      )
      let totalSaved = 0
      const chunks = []
      for (let i = 0; i < resized.length; i += BATCH_CHUNK_SIZE) {
        chunks.push(resized.slice(i, i + BATCH_CHUNK_SIZE))
      }
      let totalFailed = 0
      for (let c = 0; c < chunks.length; c++) {
        const from = c * BATCH_CHUNK_SIZE + 1
        const to = Math.min((c + 1) * BATCH_CHUNK_SIZE, resized.length)
        setMessage(`묶음 ${c + 1}/${chunks.length} 전송 중 (${from}~${to}번째)…`)
        const form = new FormData()
        chunks[c].forEach((f) => form.append('file', f))
        const res = await fetch('/api/admin/photo-pool/batch-with-suggest', { method: 'POST', body: form })
        const data = await res.json()
        if (res.ok) {
          const n = data.saved ?? 0
          totalSaved += n
          totalFailed += data.failed ?? 0
          setMessage(`묶음 ${c + 1}/${chunks.length} 완료 (방금 ${n}장 저장). ${c + 1 < chunks.length ? '다음 묶음 전송 중…' : '전체 완료.'}`)
        } else if (c === 0) throw new Error(data?.message ?? data?.error ?? '일괄 저장 실패')
      }
      setMessage(
        totalFailed > 0
          ? `${totalSaved}장 저장됨, ${totalFailed}장 실패 (도시·명소 한글, 출처 파일명)`
          : `${totalSaved}장 정리·저장됨 (도시·명소 한글, 출처는 파일명에서)`
      )
      setFiles([])
      await loadList()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '일괄 저장 실패')
    } finally {
      setBatchSaving(false)
      uploadInProgressRef.current = false
    }
  }, [files, loadList])

  const saveUpload = async () => {
    if (files.length === 0) {
      setMessage('사진을 넣거나 드래그하세요.')
      return
    }
    if (uploadInProgressRef.current) return
    uploadInProgressRef.current = true
    setUploading(true)
    setMessage(null)
    try {
      const form = new FormData()
      files.forEach((f) => form.append('file', f))
      form.append('cityName', cityNames.trim() || 'City')
      form.append('attractionName', attractionNames.trim() || 'Landmark')
      form.append('source', source.trim() || 'Upload')

      const res = await fetch('/api/admin/photo-pool/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? data?.error ?? '저장 실패')
      setMessage(`${data.saved ?? 0}장 자동 저장됨`)
      setFiles([])
      await loadList()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setUploading(false)
      uploadInProgressRef.current = false
    }
  }

  const applyReorder = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setList((prev) => {
      const next = [...prev]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, removed)
      lastOrderRef.current = next
      return next
    })
  }, [])

  const saveOrder = useCallback(async () => {
    const ordered = lastOrderRef.current.length > 0 ? lastOrderRef.current : list
    const order = ordered.map((item, i) => ({ id: item.id, sortOrder: i }))
    const res = await fetch('/api/admin/photo-pool/reorder', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order }),
    })
    if (res.ok) loadList()
    lastOrderRef.current = []
  }, [list, loadList])

  const onListDragStart = (id: string) => {
    setDraggedId(id)
    lastOrderRef.current = list
  }
  const onListDragOver = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    if (draggedId == null) return
    const from = list.findIndex((x) => x.id === draggedId)
    if (from >= 0 && from !== toIndex) applyReorder(from, toIndex)
  }
  const onListDragEnd = () => {
    if (draggedId != null) saveOrder()
    setDraggedId(null)
  }

  const deleteItem = useCallback(
    async (id: string) => {
      if (!confirm('이 사진을 풀에서 삭제할까요?')) return
      setDeletingId(id)
      try {
        const res = await fetch(`/api/admin/photo-pool/${id}`, { method: 'DELETE' })
        if (res.ok) await loadList()
        else {
          const data = await res.json().catch(() => ({}))
          setMessage(data?.error ?? '삭제 실패')
        }
      } catch {
        setMessage('삭제 실패')
      } finally {
        setDeletingId(null)
      }
    },
    [loadList]
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/admin" className="text-blue-600 hover:underline">
          ← 관리자
        </Link>
        <h1 className="text-xl font-semibold">사진넣기</h1>
      </div>
      <p className="text-sm text-gray-600">
        사진을 넣으면 제미나이가 장소를 보고 도시·명소를 추천해 파일명을 만들 수 있습니다. 원본 용량이 커도 WebP로 변환해 저장해 용량을 줄입니다. 한 번에 최대 50장.
      </p>

      {/* 업로드 영역: 드래그 시 탐색기로 열리지 않도록 preventDefault/stopPropagation 적용 */}
      <div
        role="button"
        tabIndex={0}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver ? 'border-[#10b981] bg-green-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={onFileInput}
          className="hidden"
        />
        <p className="rounded bg-blue-600 px-4 py-2 text-white inline-block">
          파일 선택 (최대 50장)
        </p>
        <p className="mt-2 text-sm text-gray-500">사진을 이 영역에 드래그해서 놓으세요 (탐색기로 열리지 않음)</p>
        {files.length > 0 && (
          <p className="mt-2 text-sm font-medium text-gray-700">
            선택됨: {files.length}장
            <button type="button" onClick={(e) => { e.stopPropagation(); setFiles([]) }} className="ml-2 text-red-600 hover:underline">
              비우기
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">도시명 (쉼표 구분)</label>
          <input
            type="text"
            value={cityNames}
            onChange={(e) => setCityNames(e.target.value)}
            placeholder="교토, 오사카"
            className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">명소명 (쉼표 구분)</label>
          <input
            type="text"
            value={attractionNames}
            onChange={(e) => setAttractionNames(e.target.value)}
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
      <button
        type="button"
        onClick={suggestWithGemini}
        disabled={suggesting || files.length === 0}
        className="rounded border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-800 disabled:opacity-50"
      >
        {suggesting ? '제미나이 분석 중…' : '제미나이로 도시·명소 추천'}
      </button>
      <p className="text-xs text-gray-500">첫 번째 사진을 제미나이가 보고 어디인지 추론해 파일명(도시_명소_출처.webp)에 씁니다. 출처는 직접 입력.</p>

      {message && (
        <p className={`block text-sm ${message.includes('저장') || message.includes('정리') ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveUpload}
          disabled={uploading || files.length === 0}
          className="rounded bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {uploading ? '저장 중…' : '저장 (자동 저장)'}
        </button>
        <button
          type="button"
          onClick={batchSaveWithSuggest}
          disabled={batchSaving || files.length === 0}
          className="rounded border border-gray-300 bg-white px-4 py-2 text-sm disabled:opacity-50"
        >
          {batchSaving ? '처리 중…' : '전부 한 번에 정리'}
        </button>
      </div>

      {/* 목록 + 드래그 순서 */}
      <div>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">풀 목록</span>
          <input
            type="text"
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            placeholder="도시 필터"
            className="rounded border px-2 py-1 text-sm"
          />
          <button type="button" onClick={loadList} className="rounded border px-2 py-1 text-sm">
            새로고침
          </button>
        </div>
        {listLoading ? (
          <p className="py-6 text-center text-sm text-gray-500">로딩 중…</p>
        ) : (
          <ul className="min-h-[120px] max-h-[min(70vh,36rem)] space-y-1 overflow-y-auto overscroll-contain pr-1 [-webkit-overflow-scrolling:touch]">
            {list.map((item, index) => (
              <li
                key={item.id}
                draggable
                onDragStart={() => onListDragStart(item.id)}
                onDragOver={(e) => onListDragOver(e, index)}
                onDragEnd={onListDragEnd}
                className={`flex items-center gap-2 rounded border bg-white p-2 ${draggedId === item.id ? 'opacity-50' : ''}`}
              >
                <span className="cursor-move shrink-0 text-gray-400" aria-hidden>⋮⋮</span>
                <img src={item.filePath} alt="" className="h-10 w-14 shrink-0 rounded object-cover" />
                <span className="min-w-0 shrink-0 text-sm font-medium">{item.cityName}</span>
                <span className="min-w-0 shrink text-sm text-gray-600">{item.attractionName}</span>
                <span className="min-w-0 truncate text-xs text-gray-400" title={item.filePath}>
                  {item.filePath.replace(/^.*\//, '')}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}
                  disabled={deletingId === item.id}
                  className="ml-auto shrink-0 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100 disabled:opacity-50"
                  title="삭제"
                >
                  {deletingId === item.id ? '삭제 중…' : '삭제'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!listLoading && list.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-500">저장된 사진이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
