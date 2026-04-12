'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PRIVATE_TRIP_HERO_COVER_HEIGHT,
  PRIVATE_TRIP_HERO_COVER_WIDTH,
  PRIVATE_TRIP_HERO_FOLDER_PUBLIC,
  PRIVATE_TRIP_HERO_STORAGE_PREFIX,
} from '@/lib/private-trip-hero-constants'
import type { PrivateTripHeroSlide, PrivateTripHeroSlidesFile } from '@/lib/private-trip-hero-types'

const EMPTY_ROW: PrivateTripHeroSlide = {
  imageUrl: '',
  headline: '',
  caption: '',
  linkHref: '',
}

const JSON_SLIDE_MAX = 50

type Props = {
  initialFile: PrivateTripHeroSlidesFile | null
}

function rowsFromFile(file: PrivateTripHeroSlidesFile | null): PrivateTripHeroSlide[] {
  const slides = file?.slides ?? []
  const rows = slides.map((s) => ({
    imageUrl: s.imageUrl ?? '',
    headline: s.headline ?? '',
    caption: s.caption ?? '',
    linkHref: s.linkHref ?? '',
  }))
  if (rows.length === 0) return [{ ...EMPTY_ROW }]
  if (rows.length >= JSON_SLIDE_MAX) return rows.slice(0, JSON_SLIDE_MAX)
  return [...rows, { ...EMPTY_ROW }]
}

export function PrivateTripHeroSlidesPanel({ initialFile }: Props) {
  const [folderUrls, setFolderUrls] = useState<string[]>([])
  const [folderDiskPath, setFolderDiskPath] = useState<string>('')
  const [folderSource, setFolderSource] = useState<'supabase' | 'disk'>('disk')
  const [directUploadAvailable, setDirectUploadAvailable] = useState(false)
  const [heroStorageBucket, setHeroStorageBucket] = useState('bongtour-images')
  const [folderLoading, setFolderLoading] = useState(true)

  const [rows, setRows] = useState<PrivateTripHeroSlide[]>(() => rowsFromFile(initialFile))
  const [meta, setMeta] = useState<{ at: string | null; by: string | null }>(() => ({
    at: initialFile?.lastUpdatedAt ?? null,
    by: initialFile?.lastUpdatedBy ?? null,
  }))
  const [jsonLoading, setJsonLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFolder = useCallback(async () => {
    setFolderLoading(true)
    try {
      const res = await fetch('/api/admin/private-trip-hero-folder')
      const data = (await res.json()) as {
        ok?: boolean
        publicUrls?: string[]
        diskPath?: string
        source?: 'supabase' | 'disk'
        directUploadAvailable?: boolean
        storageBucket?: string
        error?: string
      }
      if (!res.ok || !data.ok) {
        setMessage({ kind: 'err', text: data.error || '히어로 이미지 목록을 불러오지 못했습니다.' })
        return
      }
      setFolderUrls(Array.isArray(data.publicUrls) ? data.publicUrls : [])
      setFolderDiskPath(typeof data.diskPath === 'string' ? data.diskPath : '')
      setFolderSource(data.source === 'supabase' ? 'supabase' : 'disk')
      setDirectUploadAvailable(data.directUploadAvailable === true)
      setHeroStorageBucket(typeof data.storageBucket === 'string' ? data.storageBucket : 'bongtour-images')
    } catch {
      setMessage({ kind: 'err', text: '히어로 이미지 목록을 불러오지 못했습니다.' })
    } finally {
      setFolderLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFolder()
  }, [loadFolder])

  const uploadFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return
      setUploading(true)
      setMessage(null)
      const errors: string[] = []

      const parseJsonBody = (res: Response, raw: string) => {
        try {
          return JSON.parse(raw) as { ok?: boolean; error?: string; detail?: string }
        } catch {
          const snippet = raw.replace(/\s+/g, ' ').trim().slice(0, 180)
          return {
            ok: false,
            error: snippet
              ? `HTTP ${res.status}: ${snippet}`
              : `HTTP ${res.status} ${res.statusText || ''}`.trim(),
          }
        }
      }

      for (let i = 0; i < list.length; i++) {
        const file = list[i]!
        try {
          if (directUploadAvailable) {
            const signRes = await fetch('/api/admin/private-trip-hero-folder/upload-sign', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                byteLength: file.size,
                mimeType: file.type || 'image/jpeg',
              }),
            })
            const signRaw = await signRes.text()
            const signData = parseJsonBody(signRes, signRaw) as {
              ok?: boolean
              error?: string
              incomingPath?: string
              token?: string
              supabaseUrl?: string
              supabaseAnonKey?: string
              bucket?: string
            }
            if (
              !signRes.ok ||
              !signData.ok ||
              !signData.incomingPath ||
              !signData.token ||
              !signData.supabaseUrl ||
              !signData.supabaseAnonKey
            ) {
              errors.push(
                `${file.name}: ${signData.error || '서버에 SUPABASE_URL·SUPABASE_ANON_KEY(또는 NEXT_PUBLIC_* anon)가 없습니다.'}`,
              )
              continue
            }

            const { createClient } = await import('@supabase/supabase-js')
            const sb = createClient(signData.supabaseUrl, signData.supabaseAnonKey)
            const bucket = signData.bucket || heroStorageBucket
            const { error: upErr } = await sb.storage
              .from(bucket)
              .uploadToSignedUrl(signData.incomingPath, signData.token, file, { upsert: true })
            if (upErr) {
              errors.push(`${file.name}: Storage 직접 업로드 실패 — ${upErr.message}`)
              continue
            }

            const finRes = await fetch('/api/admin/private-trip-hero-folder/upload-finalize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                incomingPath: signData.incomingPath,
                originalFileName: file.name,
              }),
            })
            const finRaw = await finRes.text()
            const finData = parseJsonBody(finRes, finRaw) as { ok?: boolean; error?: string; detail?: string }
            if (!finRes.ok || !finData.ok) {
              const detail = finData.detail ? ` (${finData.detail})` : ''
              errors.push(`${file.name}: ${finData.error || String(finRes.status)}${detail}`)
            }
            continue
          }

          const fd = new FormData()
          fd.set('file', file)
          const res = await fetch('/api/admin/private-trip-hero-folder/upload', { method: 'POST', body: fd })
          const raw = await res.text()
          const data = parseJsonBody(res, raw) as { ok?: boolean; error?: string; detail?: string }
          if (!res.ok || !data.ok) {
            const detail = data.detail ? ` (${data.detail})` : ''
            let line = `${file.name}: ${data.error || String(res.status)}${detail}`
            if (res.status === 413) {
              line +=
                ' — 우리여행 히어로(이 섹션) 업로드가 nginx 본문 한도에 걸렸습니다. `server { }`에 `client_max_body_size 35m;`를 넣거나, 서버에 `SUPABASE_ANON_KEY` 등 직접 업로드 설정을 켜 주세요.'
            }
            errors.push(line)
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          errors.push(`${file.name}: 연결 실패 — ${msg}`)
        }
      }
      await loadFolder()
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (errors.length) {
        setMessage({
          kind: 'err',
          text:
            errors.slice(0, 6).join('\n') + (errors.length > 6 ? `\n… 외 ${errors.length - 6}건` : ''),
        })
      } else {
        setMessage({
          kind: 'ok',
          text: `${list.length}개 처리 완료: ${PRIVATE_TRIP_HERO_COVER_WIDTH}×${PRIVATE_TRIP_HERO_COVER_HEIGHT} WebP(cover)로 저장했습니다.`,
        })
      }
    },
    [loadFolder, directUploadAvailable, heroStorageBucket],
  )

  const refreshJson = useCallback(async () => {
    setJsonLoading(true)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/private-trip-hero-slides')
      const data = (await res.json()) as { ok?: boolean; file?: PrivateTripHeroSlidesFile }
      if (!res.ok || !data.ok || !data.file) {
        setMessage({ kind: 'err', text: 'JSON을 불러오지 못했습니다.' })
        return
      }
      setRows(rowsFromFile(data.file))
      setMeta({ at: data.file.lastUpdatedAt ?? null, by: data.file.lastUpdatedBy ?? null })
    } catch {
      setMessage({ kind: 'err', text: 'JSON을 불러오지 못했습니다.' })
    } finally {
      setJsonLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialFile) void refreshJson()
  }, [initialFile, refreshJson])

  const setRow = (i: number, patch: Partial<PrivateTripHeroSlide>) => {
    setRows((prev) => {
      const next = [...prev]
      next[i] = { ...next[i]!, ...patch }
      return next
    })
  }

  const addRow = () => {
    setRows((prev) => (prev.length >= JSON_SLIDE_MAX ? prev : [...prev, { ...EMPTY_ROW }]))
  }

  const removeRow = (i: number) => {
    setRows((prev) => {
      const next = prev.filter((_, j) => j !== i)
      return next.length === 0 ? [{ ...EMPTY_ROW }] : next
    })
  }

  const saveJson = async () => {
    setSaving(true)
    setMessage(null)
    const slides = rows
      .map((r) => ({
        imageUrl: r.imageUrl.trim(),
        headline: r.headline?.trim() || undefined,
        caption: r.caption?.trim() || undefined,
        linkHref: r.linkHref?.trim() || undefined,
      }))
      .filter((r) => r.imageUrl.length > 0)
    try {
      const res = await fetch('/api/admin/private-trip-hero-slides', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slides }),
      })
      const data = (await res.json()) as { ok?: boolean; file?: PrivateTripHeroSlidesFile; error?: string }
      if (!res.ok || !data.ok || !data.file) {
        setMessage({ kind: 'err', text: data.error || '저장에 실패했습니다.' })
        return
      }
      setRows(rowsFromFile(data.file))
      setMeta({ at: data.file.lastUpdatedAt ?? null, by: data.file.lastUpdatedBy ?? null })
      setMessage({
        kind: 'ok',
        text:
          folderUrls.length > 0
            ? 'JSON을 저장했습니다. 지금은 히어로 이미지 풀(저장소·디스크)에 파일이 있어 풀만 쓰입니다. 풀을 비우면 이 JSON이 적용됩니다.'
            : '저장했습니다. 우리여행 페이지를 새로고침해 확인하세요.',
      })
    } catch {
      setMessage({ kind: 'err', text: '저장에 실패했습니다.' })
    } finally {
      setSaving(false)
    }
  }

  const filled = rows.filter((r) => r.imageUrl.trim().length > 0).length
  const folderActive = folderUrls.length > 0

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-900/40 p-4 sm:p-5">
      <div className="border-b border-slate-700 pb-4">
        <h2 className="text-base font-semibold text-white">우리여행 히어로 (이미지 풀)</h2>
        <p className="mt-2 text-sm text-slate-400">
          <strong className="text-slate-200">Supabase Storage</strong>가 서버에 연결되어 있으면 버킷 접두사{' '}
          <code className="text-teal-200/90">{PRIVATE_TRIP_HERO_STORAGE_PREFIX}/</code> 아래 파일을 우선 사용합니다.
          비어 있거나 미연결이면 <strong className="text-slate-200">서버 디스크</strong>{' '}
          <code className="text-slate-300">{PRIVATE_TRIP_HERO_FOLDER_PUBLIC}/</code> 를 봅니다. 장 수는{' '}
          <span className="text-slate-300">상한 500</span>, 파일명 오름차순입니다.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          <strong className="text-slate-200">업로드</strong> 시 서버가 바로{' '}
          <span className="text-teal-200/90">
            {PRIVATE_TRIP_HERO_COVER_WIDTH}×{PRIVATE_TRIP_HERO_COVER_HEIGHT} 와이드에 맞춰 중앙 크롭
          </span>
          하고 <span className="text-teal-200/90">WebP</span>로 맞춥니다(히어로 영역·용량 통일).
        </p>
        <p className="mt-2 font-mono text-xs text-teal-200/90">
          {folderSource === 'supabase' ? '저장소 URL' : `${PRIVATE_TRIP_HERO_FOLDER_PUBLIC}/`}
          <span className="text-slate-400">(이미지 파일만)</span>
        </p>
        {folderDiskPath ? (
          <p className="mt-1 font-mono text-[11px] text-slate-500">서버 경로: {folderDiskPath}</p>
        ) : null}
        {directUploadAvailable ? (
          <p className="mt-2 text-xs text-emerald-300/90">
            대용량은 브라우저가 Supabase Storage로 직접 올려 nginx 본문 한도(413)의 영향을 줄입니다. (서버에 SUPABASE_URL·SUPABASE_ANON_KEY·service role 등 Storage 설정 시)
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || folderLoading}
            className="rounded-lg border border-teal-600/70 bg-teal-950/40 px-3 py-1.5 text-xs font-semibold text-teal-200 hover:bg-teal-900/50 disabled:opacity-50"
          >
            {uploading ? '업로드·변환 중…' : '이미지 업로드 (자동 맞춤)'}
          </button>
          <button
            type="button"
            onClick={() => void loadFolder()}
            disabled={folderLoading || uploading}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {folderLoading ? '폴더 읽는 중…' : '폴더 다시 읽기'}
          </button>
          <a
            href="/travel/overseas/private-trip"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-center text-xs font-medium text-teal-300 hover:border-teal-500/60 hover:bg-slate-800/80"
          >
            우리여행에서 보기
          </a>
        </div>
      </div>

      {message ? (
        <p
          className={`mt-3 whitespace-pre-line rounded-lg px-3 py-2 text-sm ${message.kind === 'ok' ? 'bg-emerald-950/50 text-emerald-200' : 'bg-rose-950/40 text-rose-200'}`}
        >
          {message.text}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-200">
          히어로 이미지 {folderLoading ? '…' : `${folderUrls.length}장`}
          {folderActive ? (
            <span className="ml-2 text-xs font-normal text-emerald-300">
              → 히어로에 이 {folderSource === 'supabase' ? '저장소' : '폴더'}만 사용 중
            </span>
          ) : (
            <span className="ml-2 text-xs font-normal text-slate-500">
              → 이미지 풀이 비어 있으면 아래 JSON 또는 상품 풀
            </span>
          )}
        </p>
        {!folderLoading && folderUrls.length > 0 ? (
          <ul className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {folderUrls.map((url) => (
              <li
                key={url}
                className="overflow-hidden rounded-lg border border-slate-700 bg-slate-950/60"
                title={url}
              >
                <img src={url} alt="" className="aspect-[16/10] w-full object-cover" loading="lazy" />
                <p className="truncate px-1.5 py-1 font-mono text-[10px] text-slate-500">{decodeURIComponent(url.split('/').pop() ?? '')}</p>
              </li>
            ))}
          </ul>
        ) : !folderLoading && folderUrls.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            아직 파일이 없습니다. 「이미지 업로드」를 쓰거나, Supabase 미사용 환경이면 서버에{' '}
            <code className="text-slate-400">public/images/private-trip-hero/</code> 에 넣은 뒤 「폴더 다시 읽기」를
            누르세요.
          </p>
        ) : null}
      </div>

      <details className="mt-8 rounded-lg border border-slate-700/80 bg-slate-950/30 p-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-300">
          JSON 보조 설정 (이미지 풀이 <span className="text-amber-200/90">완전히 비어 있을 때만</span> 히어로에 사용, 최대{' '}
          {JSON_SLIDE_MAX}줄)
        </summary>
        <p className="mt-2 text-xs text-slate-500">
          파일: <code className="text-slate-400">public/data/private-trip-hero-slides.json</code>
          {meta.at ? (
            <>
              {' '}
              · 마지막 저장: {new Date(meta.at).toLocaleString('ko-KR')}
              {meta.by ? ` (${meta.by})` : ''}
            </>
          ) : null}
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => void refreshJson()}
            disabled={jsonLoading}
            className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            JSON 불러오기
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {rows.map((row, i) => (
            <div
              key={`slide-row-${i}`}
              className="rounded-lg border border-slate-700/80 bg-slate-950/40 p-3 sm:flex sm:items-stretch sm:gap-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">이미지 URL *</span>
                  <input
                    value={row.imageUrl}
                    onChange={(e) => setRow(i, { imageUrl: e.target.value })}
                    placeholder="https://… 또는 /images/…"
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-600"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">헤드라인</span>
                  <input
                    value={row.headline ?? ''}
                    onChange={(e) => setRow(i, { headline: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">캡션</span>
                  <input
                    value={row.caption ?? ''}
                    onChange={(e) => setRow(i, { caption: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">클릭 URL (선택)</span>
                  <input
                    value={row.linkHref ?? ''}
                    onChange={(e) => setRow(i, { linkHref: e.target.value })}
                    className="mt-1 w-full rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
                  />
                </label>
              </div>
              <div className="mt-2 flex shrink-0 sm:mt-0 sm:flex-col sm:justify-end">
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={addRow}
            disabled={rows.length >= JSON_SLIDE_MAX}
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40"
          >
            행 추가 ({filled}/{JSON_SLIDE_MAX})
          </button>
          <button
            type="button"
            onClick={() => void saveJson()}
            disabled={saving || filled === 0}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
          >
            {saving ? '저장 중…' : 'JSON 저장'}
          </button>
        </div>
      </details>
    </section>
  )
}
