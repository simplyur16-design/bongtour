'use client'

import SafeImage from '@/app/components/SafeImage'
import { useCallback, useEffect, useRef, useState } from 'react'

type OgPageKey = 'default' | 'overseas' | 'private-trip' | 'domestic' | 'training' | 'esim'

const PAGE_ORDER: OgPageKey[] = ['default', 'overseas', 'private-trip', 'domestic', 'training', 'esim']

const PAGE_LABELS: Record<
  OgPageKey,
  { label: string; url: string; description: string }
> = {
  default: {
    label: '기본 (모든 페이지)',
    url: '/',
    description: '다른 설정이 없을 때 사용',
  },
  overseas: {
    label: '해외여행 메인',
    url: '/travel/overseas',
    description: '/travel/overseas 페이지',
  },
  'private-trip': {
    label: '우리끼리 (단체/모임)',
    url: '/travel/overseas/private-trip',
    description: '/travel/overseas/private-trip',
  },
  domestic: {
    label: '국내여행',
    url: '/travel/domestic',
    description: '/travel/domestic',
  },
  training: {
    label: '국외연수',
    url: '/training',
    description: '/training',
  },
  esim: {
    label: 'e-SIM',
    url: '/travel/esim',
    description: '/travel/esim',
  },
}

type OgAssetApi = {
  id: string
  pageKey: string
  imageUrl: string
  storagePath: string | null
  width: number | null
  height: number | null
  fileSize: number | null
  uploadedBy: string | null
  createdAt: string
  updatedAt: string
}

type ListState = 'loading' | 'ready' | 'forbidden' | 'error'

const MAX_BYTES = 5 * 1024 * 1024
const KAKAO_DEBUG_BASE = 'https://developers.kakao.com/tool/debugger/sharing?url='
const PROD_ORIGIN = 'https://bongtour.com'

type Props = { actorRole: string | null | undefined }

export default function OgImagesManager({ actorRole }: Props) {
  const canManage = actorRole === 'ADMIN' || actorRole === 'SUPER_ADMIN'
  const [items, setItems] = useState<Partial<Record<OgPageKey, OgAssetApi | null>>>({})
  const [listState, setListState] = useState<ListState>('loading')
  const [listErr, setListErr] = useState('')
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [uploadingKey, setUploadingKey] = useState<OgPageKey | null>(null)
  const [deletingKey, setDeletingKey] = useState<OgPageKey | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingPageKeyRef = useRef<OgPageKey | null>(null)

  const loadList = useCallback(async () => {
    setListState('loading')
    setListErr('')
    try {
      const res = await fetch('/api/admin/og-images', { cache: 'no-store' })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        items?: Partial<Record<OgPageKey, OgAssetApi | null>>
        error?: string
      }
      if (res.status === 401 || res.status === 403) {
        setListState('forbidden')
        setItems({})
        return
      }
      if (!res.ok || !data.ok) {
        setListState('error')
        setListErr(data.error ?? '목록을 불러오지 못했습니다.')
        setItems({})
        return
      }
      setItems(data.items ?? {})
      setListState('ready')
    } catch {
      setListState('error')
      setListErr('네트워크 오류로 목록을 불러오지 못했습니다.')
      setItems({})
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const showBanner = (type: 'ok' | 'err', text: string) => {
    setBanner({ type, text })
    window.setTimeout(() => setBanner(null), 6000)
  }

  const onPickFile = (pageKey: OgPageKey) => {
    if (!canManage) {
      window.alert('관리자 권한이 필요합니다.')
      return
    }
    pendingPageKeyRef.current = pageKey
    fileInputRef.current?.click()
  }

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const pageKey = pendingPageKeyRef.current
    e.target.value = ''
    pendingPageKeyRef.current = null
    if (!file || !pageKey) return

    if (file.size > MAX_BYTES) {
      window.alert('파일 크기는 5MB 이하여야 합니다.')
      return
    }

    const mime = (file.type || '').split(';')[0]?.trim().toLowerCase() || ''
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) {
      window.alert('PNG, JPEG, WebP만 업로드할 수 있습니다.')
      return
    }

    try {
      const dims = await readImageDimensions(file)
      if (dims && (dims.width !== 1200 || dims.height !== 630)) {
        const ok = window.confirm(
          `권장 크기는 1200×630px 입니다. 현재 ${dims.width}×${dims.height}px 입니다. 그대로 업로드할까요?`
        )
        if (!ok) return
      }
    } catch {
      /* 크기 읽기 실패 시 업로드 계속 */
    }

    setUploadingKey(pageKey)
    try {
      const fd = new FormData()
      fd.set('file', file)
      fd.set('pageKey', pageKey)
      const res = await fetch('/api/admin/og-images', { method: 'POST', body: fd })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.status === 401 || res.status === 403) {
        window.alert('인증이 만료되었거나 권한이 없습니다.')
        return
      }
      if (!res.ok || !data.ok) {
        window.alert(data.error ?? '업로드에 실패했습니다.')
        return
      }
      showBanner('ok', '업로드되었습니다.')
      await loadList()
    } catch {
      window.alert('네트워크 오류로 업로드에 실패했습니다.')
    } finally {
      setUploadingKey(null)
    }
  }

  const onDelete = async (pageKey: OgPageKey) => {
    if (!canManage) {
      window.alert('관리자 권한이 필요합니다.')
      return
    }
    if (!window.confirm('이 OG 이미지를 삭제하시겠습니까?')) return
    setDeletingKey(pageKey)
    try {
      const res = await fetch(`/api/admin/og-images/${encodeURIComponent(pageKey)}`, {
        method: 'DELETE',
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (res.status === 401 || res.status === 403) {
        window.alert('인증이 만료되었거나 권한이 없습니다.')
        return
      }
      if (!res.ok || !data.ok) {
        window.alert(data.error ?? '삭제에 실패했습니다.')
        return
      }
      showBanner('ok', '삭제되었습니다.')
      await loadList()
    } catch {
      window.alert('네트워크 오류로 삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  const kakaoDebuggerUrl = (path: string) => {
    const absolute = `${PROD_ORIGIN}${path === '/' ? '' : path}`
    return `${KAKAO_DEBUG_BASE}${encodeURIComponent(absolute)}`
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 bg-white p-6 text-bt-body">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFileSelected}
      />

      <header className="space-y-2 border-b border-bt-border pb-6">
        <h1 className="text-2xl font-semibold text-bt-title">OG 이미지 관리</h1>
        <p className="text-sm text-bt-muted">카카오톡/페이스북 공유 시 표시되는 이미지</p>
        <p className="text-sm text-bt-body">권장 1200×630 PNG/JPEG/WebP, 5MB 이하</p>
        <p className="text-sm font-medium text-amber-800">
          업로드 후 카카오톡 디버거에서 캐시 무효화가 필요할 수 있습니다.
        </p>
        {!canManage ? (
          <p className="text-sm text-bt-warning">ADMIN / SUPER_ADMIN 만 업로드·삭제할 수 있습니다.</p>
        ) : null}
      </header>

      {banner ? (
        <div
          className={`rounded-lg px-4 py-2 text-sm ${
            banner.type === 'ok' ? 'bg-emerald-50 text-emerald-900' : 'bg-red-50 text-red-900'
          }`}
        >
          {banner.text}
        </div>
      ) : null}

      {listState === 'loading' ? (
        <p className="text-sm text-bt-muted">불러오는 중…</p>
      ) : listState === 'forbidden' ? (
        <p className="text-sm text-bt-warning">접근 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.</p>
      ) : listState === 'error' ? (
        <p className="text-sm text-bt-warning">{listErr}</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {PAGE_ORDER.map((key) => {
            const meta = PAGE_LABELS[key]
            const row = items[key] ?? null
            const hasDb = Boolean(row?.imageUrl)
            const busy = uploadingKey === key || deletingKey === key
            return (
              <div
                key={key}
                className="flex flex-col rounded-xl border border-bt-border bg-white p-6 shadow-sm"
              >
                <h2 className="text-lg font-semibold text-bt-title">{meta.label}</h2>
                <p className="mt-1 text-xs text-bt-muted">{meta.description}</p>
                <p className="mt-0.5 font-mono text-[11px] text-bt-meta">pageKey: {key}</p>

                <div className="mt-4 flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-bt-border bg-bt-surface-soft">
                  {hasDb ? (
                    <SafeImage
                      src={row!.imageUrl ?? ''}
                      alt=""
                      width={1200}
                      height={630}
                      className="max-h-36 max-w-full object-contain"
                      onError={(ev) => {
                        const t = ev.currentTarget
                        t.style.display = 'none'
                      }}
                    />
                  ) : (
                    <span className="px-4 text-center text-sm text-bt-muted">기본 이미지 사용 중</span>
                  )}
                </div>

                {hasDb && row?.width && row?.height ? (
                  <p className="mt-2 text-xs text-bt-meta">
                    {row.width}×{row.height}px
                    {row.fileSize != null ? ` · ${(row.fileSize / 1024).toFixed(0)} KB` : ''}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canManage || busy}
                    onClick={() => onPickFile(key)}
                    className="rounded-lg bg-bt-brand-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {uploadingKey === key ? '업로드 중…' : '이미지 업로드'}
                  </button>
                  {hasDb ? (
                    <button
                      type="button"
                      disabled={!canManage || busy}
                      onClick={() => void onDelete(key)}
                      className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingKey === key ? '삭제 중…' : '삭제'}
                    </button>
                  ) : null}
                  <a
                    href={kakaoDebuggerUrl(meta.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center rounded-lg border border-bt-border px-3 py-2 text-sm font-medium text-bt-link hover:bg-bt-surface-soft"
                  >
                    카카오 디버거
                  </a>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new window.Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('load failed'))
    }
    img.src = url
  })
}
