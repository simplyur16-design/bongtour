'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PRIVATE_TRIP_HERO_COVER_HEIGHT,
  PRIVATE_TRIP_HERO_COVER_WIDTH,
  PRIVATE_TRIP_HERO_STORAGE_PREFIX,
} from '@/lib/private-trip-hero-constants'
import SafeImage from '@/app/components/SafeImage'

/** 우리여행 히어로: Object Storage(Ncloud) 이미지 풀만 관리 (공개 `/travel/overseas/private-trip`와 동일 소스) */
export function PrivateTripHeroSlidesPanel() {
  const [folderUrls, setFolderUrls] = useState<string[]>([])
  const [folderLocationNote, setFolderLocationNote] = useState<string>('')
  const [folderSource, setFolderSource] = useState<'supabase' | 'none'>('none')
  const [storageConfigured, setStorageConfigured] = useState(false)
  const [directUploadAvailable, setDirectUploadAvailable] = useState(false)
  const [folderLoading, setFolderLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingPublicUrl, setDeletingPublicUrl] = useState<string | null>(null)
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFolder = useCallback(async () => {
    setFolderLoading(true)
    try {
      const res = await fetch('/api/admin/private-trip-hero-folder')
      const data = (await res.json()) as {
        ok?: boolean
        publicUrls?: string[]
        locationNote?: string
        source?: 'supabase' | 'none'
        storageConfigured?: boolean
        directUploadAvailable?: boolean
        error?: string
      }
      if (!res.ok || !data.ok) {
        setMessage({ kind: 'err', text: data.error || 'Storage 목록을 불러오지 못했습니다.' })
        return
      }
      setFolderUrls(Array.isArray(data.publicUrls) ? data.publicUrls : [])
      setFolderLocationNote(typeof data.locationNote === 'string' ? data.locationNote : '')
      setFolderSource(data.source === 'supabase' ? 'supabase' : 'none')
      setStorageConfigured(data.storageConfigured === true)
      setDirectUploadAvailable(data.directUploadAvailable === true)
    } catch {
      setMessage({ kind: 'err', text: 'Storage 목록을 불러오지 못했습니다.' })
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
              uploadUrl?: string
              contentType?: string
            }
            if (!signRes.ok || !signData.ok || !signData.incomingPath || !signData.uploadUrl || !signData.contentType) {
              errors.push(
                `${file.name}: ${signData.error || '서버에 NCLOUD Object Storage 설정이 없거나 presigned URL 발급에 실패했습니다.'}`,
              )
              continue
            }

            const putRes = await fetch(signData.uploadUrl, {
              method: 'PUT',
              body: file,
              headers: { 'Content-Type': signData.contentType },
            })
            if (!putRes.ok) {
              const putSnippet = (await putRes.text()).replace(/\s+/g, ' ').trim().slice(0, 200)
              errors.push(
                `${file.name}: Ncloud 직접 업로드 실패 HTTP ${putRes.status}${putSnippet ? ` — ${putSnippet}` : ''}`,
              )
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
                ' — nginx 본문 한도(413)면 `client_max_body_size`를 늘리거나, NCLOUD Object Storage 직접 업로드(presigned PUT)를 켜 주세요.'
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
          text: errors.slice(0, 6).join('\n') + (errors.length > 6 ? `\n… 외 ${errors.length - 6}건` : ''),
        })
      } else {
        setMessage({
          kind: 'ok',
          text: `${list.length}개 처리 완료: ${PRIVATE_TRIP_HERO_COVER_WIDTH}×${PRIVATE_TRIP_HERO_COVER_HEIGHT} WebP(cover)로 Storage에 저장했습니다.`,
        })
      }
    },
    [loadFolder, directUploadAvailable],
  )

  const deleteImage = useCallback(
    async (publicUrl: string) => {
      if (!storageConfigured) return
      const ok = window.confirm(
        '이 이미지를 Storage에서 삭제할까요?\n삭제 후 공개 우리여행 상단 목록에서도 사라집니다.',
      )
      if (!ok) return

      setDeletingPublicUrl(publicUrl)
      setMessage(null)
      try {
        const res = await fetch('/api/admin/private-trip-hero-folder', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicUrl }),
        })
        const raw = await res.text()
        let data: { ok?: boolean; error?: string }
        try {
          data = JSON.parse(raw) as { ok?: boolean; error?: string }
        } catch {
          data = { ok: false, error: raw.slice(0, 120) || `HTTP ${res.status}` }
        }
        if (!res.ok || !data.ok) {
          setMessage({ kind: 'err', text: data.error || '삭제에 실패했습니다.' })
          return
        }
        setMessage({ kind: 'ok', text: 'Storage에서 삭제했습니다. 공개 상단은 동일 Storage 목록을 씁니다.' })
        try {
          await loadFolder()
        } catch (e2) {
          const m2 = e2 instanceof Error ? e2.message : String(e2)
          setMessage({
            kind: 'err',
            text: `삭제는 완료되었으나 목록 새로고침에 실패했습니다: ${m2}\n아래「목록 새로고침」을 눌러 주세요.`,
          })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setMessage({ kind: 'err', text: `삭제 요청 실패: ${msg}` })
      } finally {
        setDeletingPublicUrl(null)
      }
    },
    [loadFolder, storageConfigured],
  )

  const folderActive = folderUrls.length > 0

  return (
    <section className="rounded-xl border border-slate-600 bg-slate-900/40 p-4 sm:p-5">
      <div className="border-b border-slate-700 pb-4">
        <h2 className="text-base font-semibold text-white">우리여행 히어로 (Storage 이미지 풀)</h2>
        <p className="mt-2 text-sm text-amber-100/90">
          <strong className="text-white">공개</strong>{' '}
          <code className="text-amber-200/90">/travel/overseas/private-trip</code> 상단과 동일하게, 버킷 접두사{' '}
          <code className="text-teal-200/90">{PRIVATE_TRIP_HERO_STORAGE_PREFIX}/</code> 의 파일만 사용합니다.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          <strong className="text-slate-200">업로드</strong> 시{' '}
          <span className="text-teal-200/90">
            {PRIVATE_TRIP_HERO_COVER_WIDTH}×{PRIVATE_TRIP_HERO_COVER_HEIGHT}
          </span>{' '}
          cover·<span className="text-teal-200/90">WebP</span>로 맞춰 Storage에 올립니다.{' '}
          <strong className="text-slate-200">삭제</strong>는 각 썸네일에서 Storage 객체만 제거합니다.
        </p>
        {folderLocationNote ? (
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-slate-500">{folderLocationNote}</p>
        ) : null}
        {!storageConfigured ? (
          <p className="mt-2 text-xs text-rose-200/90">
            서버에 Supabase Storage(SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 등)가 없으면 목록·업로드를 할 수 없습니다.
          </p>
        ) : null}
        {directUploadAvailable ? (
          <p className="mt-2 text-xs text-emerald-300/90">
            대용량은 브라우저가 Storage로 직접 올려 nginx 본문 한도(413)의 영향을 줄입니다.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.avif,.heic,.heif"
            multiple
            className="hidden"
            disabled={uploading || !storageConfigured}
            onChange={(e) => void uploadFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || folderLoading || !storageConfigured}
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
            {folderLoading ? '목록 불러오는 중…' : '목록 새로고침'}
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
          Storage 이미지 {folderLoading ? '…' : `${folderUrls.length}장`}
          {folderActive ? (
            <span className="ml-2 text-xs font-normal text-emerald-300">→ 공개 상단에 동일하게 반영됩니다.</span>
          ) : folderSource === 'supabase' ? (
            <span className="ml-2 text-xs font-normal text-slate-500">→ 아직 없습니다. 업로드하면 공개에 표시됩니다.</span>
          ) : null}
        </p>
        {!folderLoading && folderUrls.length > 0 ? (
          <ul className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {folderUrls.map((url) => (
              <li
                key={url}
                className="flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950/60"
                title="미리보기"
              >
                <div className="relative aspect-[16/10] w-full min-h-0 flex-1 overflow-hidden">
                  <SafeImage src={url} alt="" fill className="object-cover" sizes="200px" loading="lazy" />
                </div>
                <div className="border-t border-slate-700/80 p-1.5">
                  <button
                    type="button"
                    disabled={Boolean(deletingPublicUrl) || uploading || !storageConfigured}
                    onClick={() => void deleteImage(url)}
                    className="w-full rounded-md border border-rose-900/60 bg-rose-950/30 px-2 py-1 text-[11px] font-medium text-rose-200 hover:bg-rose-950/50 disabled:opacity-50"
                  >
                    {deletingPublicUrl === url ? '삭제 중…' : '이 이미지 삭제'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : !folderLoading && folderUrls.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            {!storageConfigured
              ? 'Supabase Storage를 설정한 뒤 다시 시도하세요.'
              : '이미지를 업로드하면 여기와 공개 페이지에 표시됩니다.'}
          </p>
        ) : null}
      </div>
    </section>
  )
}
