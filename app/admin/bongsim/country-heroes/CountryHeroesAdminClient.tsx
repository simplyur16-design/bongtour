'use client'

import Image from 'next/image'
import { useCallback, useEffect, useState } from 'react'

type CountryRow = { code: string; nameKr: string }

type PexelsSearchPhoto = {
  id: number
  thumbnail: string
  medium: string
  large: string
  photographer: string
  sourceUrl: string
}

type PexelsSearchResponse = { ok: true; query: string; photos: PexelsSearchPhoto[] } | { ok: false; error: string }

type ModalState = { code: string; nameKr: string }

function flagCdnUrl(code: string): string {
  return `https://flagcdn.com/w160/${code.toLowerCase()}.png`
}

/** Prod CSP / mixed content — `next/image` 미리보기용 (AdminPendingDetailPanel과 동일) */
function adminPreviewImgSrc(url: string | null | undefined): string | undefined {
  if (url == null) return undefined
  const u = String(url).trim()
  if (!u) return undefined
  if (u.startsWith('http://')) return `https://${u.slice('http://'.length)}`
  if (u.startsWith('/') && typeof window !== 'undefined') {
    return `${window.location.origin}${u}`
  }
  return u
}

export default function CountryHeroesAdminClient() {
  const [countries, setCountries] = useState<CountryRow[]>([])
  const [heroByCode, setHeroByCode] = useState<Record<string, string>>({})
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rowMessage, setRowMessage] = useState<Record<string, string | null>>({})

  const [modal, setModal] = useState<ModalState | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [pexelsLoading, setPexelsLoading] = useState(false)
  const [pexelsError, setPexelsError] = useState<string | null>(null)
  const [pexelsPhotos, setPexelsPhotos] = useState<PexelsSearchPhoto[]>([])
  const [pexelsQuery, setPexelsQuery] = useState<string | null>(null)
  const [selected, setSelected] = useState<PexelsSearchPhoto | null>(null)
  const [saving, setSaving] = useState(false)
  const [modalFooterMsg, setModalFooterMsg] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoadErr(null)
    setLoading(true)
    try {
      const [cRes, hRes] = await Promise.all([
        fetch('/api/bongsim/countries', { cache: 'no-store' }),
        fetch('/api/bongsim/country-heroes', { cache: 'no-store' }),
      ])
      const cJson = (await cRes.json()) as { countries?: CountryRow[]; error?: string }
      if (!cRes.ok) {
        setLoadErr(cJson.error ?? `국가 목록 HTTP ${cRes.status}`)
        setCountries([])
      } else {
        setCountries(Array.isArray(cJson.countries) ? cJson.countries : [])
      }

      const hJson = (await hRes.json()) as Record<string, string> & { error?: string }
      if (!hRes.ok || typeof hJson.error === 'string') {
        if (!cRes.ok) {
          /* keep loadErr from countries */
        } else {
          setLoadErr((prev) => prev ?? hJson.error ?? `히어로 HTTP ${hRes.status}`)
        }
        setHeroByCode({})
      } else {
        const next: Record<string, string> = {}
        for (const [k, v] of Object.entries(hJson)) {
          if (k === 'error') continue
          if (typeof v === 'string' && v.trim()) next[k.toLowerCase()] = v.trim()
        }
        setHeroByCode(next)
      }
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : '불러오기 실패')
      setCountries([])
      setHeroByCode({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const openModal = (code: string, nameKr: string) => {
    setModal({ code, nameKr })
    setSearchInput(nameKr.trim() || code)
    setPexelsPhotos([])
    setPexelsError(null)
    setPexelsQuery(null)
    setSelected(null)
    setModalFooterMsg(null)
  }

  const closeModal = () => {
    setModal(null)
    setPexelsPhotos([])
    setPexelsError(null)
    setPexelsQuery(null)
    setSelected(null)
    setModalFooterMsg(null)
  }

  useEffect(() => {
    if (!modal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal, saving])

  const runPexelsSearch = async () => {
    const q = searchInput.trim()
    if (!q) {
      setPexelsError('검색어를 입력하세요.')
      return
    }
    setPexelsLoading(true)
    setPexelsError(null)
    setPexelsPhotos([])
    setSelected(null)
    setModalFooterMsg(null)
    setPexelsQuery(q)
    try {
      const res = await fetch(`/api/admin/pexels/search?q=${encodeURIComponent(q)}`)
      const data = (await res.json()) as PexelsSearchResponse
      if (!res.ok || !data.ok) {
        setPexelsError('error' in data ? data.error : '검색에 실패했습니다.')
        setPexelsPhotos([])
        return
      }
      setPexelsPhotos(data.photos)
      if (data.photos.length === 0) {
        setPexelsError('검색 결과가 없습니다. 다른 키워드를 시도해 보세요.')
      }
    } catch {
      setPexelsError('네트워크 오류')
      setPexelsPhotos([])
    } finally {
      setPexelsLoading(false)
    }
  }

  const saveSelectedHero = async () => {
    if (!modal || !selected) return
    const lower = modal.code.toLowerCase()
    const downloadUrl = (selected.large || selected.medium || '').trim()
    if (!downloadUrl) {
      setModalFooterMsg('선택한 이미지 URL이 없습니다.')
      return
    }
    setSaving(true)
    setModalFooterMsg(null)
    try {
      const res = await fetch(`/api/admin/bongsim/country-heroes/${encodeURIComponent(lower)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: downloadUrl,
          entityNameKr: modal.nameKr.trim() || lower.toUpperCase(),
          photographer: selected.photographer,
          sourceUrl: selected.sourceUrl,
          pexelsPhotoId: selected.id,
        }),
      })
      const data = (await res.json()) as { ok?: boolean; publicUrl?: string; error?: string }
      if (!res.ok || !data.ok) {
        setModalFooterMsg(data.error ?? `저장 실패 (${res.status})`)
        return
      }
      const url = data.publicUrl?.trim()
      if (url) {
        setHeroByCode((prev) => ({ ...prev, [lower]: url }))
        setRowMessage((m) => ({ ...m, [lower]: '저장됨 (Pexels → 풀 → ImageAsset)' }))
        closeModal()
      } else {
        setModalFooterMsg('응답에 publicUrl이 없습니다.')
      }
    } catch (e) {
      setModalFooterMsg(e instanceof Error ? e.message : '요청 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-slate-100">
        <h1 className="text-lg font-semibold text-white">봉심 eSIM · 국가별 추천 히어로</h1>
        <p className="mt-1 text-sm text-slate-400">
          단독 플랜이 있는 국가만 표시됩니다. Pexels에서 고른 이미지는 사진 풀(Ncloud)에 저장된 뒤{' '}
          <span className="font-mono text-slate-300">ImageAsset</span>(<span className="font-mono">recommend_hero</span>
          )로 연결되며, 사용자 퍼널은{' '}
          <span className="font-mono text-slate-300">GET /api/bongsim/country-heroes</span>로 반영됩니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-teal-300 hover:border-teal-500/60 hover:bg-slate-800/80 disabled:opacity-50"
          >
            다시 불러오기
          </button>
          <a
            href="/travel/esim/recommend"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-500 hover:bg-slate-800/80"
          >
            추천 퍼널에서 보기
          </a>
        </div>
      </div>

      {loadErr ? (
        <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
          {loadErr}
        </div>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">불러오는 중…</p>
      ) : countries.length === 0 ? (
        <p className="text-sm text-slate-500">표시할 국가가 없습니다. DB에 단독 플랜이 연결되어 있는지 확인하세요.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map(({ code, nameKr }) => {
            const lower = code.toLowerCase()
            const hero = heroByCode[lower]
            const msg = rowMessage[lower]
            return (
              <li
                key={code}
                className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/40 shadow-md"
              >
                <div className="relative h-40 w-full overflow-hidden bg-gray-900">
                  {hero ? (
                    <Image src={hero} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 320px" />
                  ) : (
                    <div className="absolute inset-0 overflow-hidden">
                      <Image
                        src={flagCdnUrl(code)}
                        alt=""
                        fill
                        quality={90}
                        className="scale-110 object-cover blur-[20px]"
                        sizes="(max-width:768px) 100vw, 320px"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/45" aria-hidden />
                    </div>
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent"
                    aria-hidden
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 px-3 pb-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full ring-1 ring-white/30">
                      <Image
                        src={flagCdnUrl(code)}
                        alt=""
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                        sizes="40px"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white drop-shadow">{nameKr}</p>
                      <p className="font-mono text-xs text-white/70">{code.toUpperCase()}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <button
                    type="button"
                    onClick={() => openModal(code, nameKr)}
                    className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500"
                  >
                    이미지 검색 (Pexels)
                  </button>
                  {msg ? (
                    <p className={`text-xs ${msg.startsWith('저장됨') ? 'text-emerald-400' : 'text-amber-200'}`}>{msg}</p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {modal ? (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-10 sm:pt-16"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bongsim-hero-modal-title"
        >
          <div className="relative w-full max-w-3xl rounded-2xl border border-slate-600 bg-slate-900 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-700 px-4 py-3 sm:px-5">
              <div>
                <h2 id="bongsim-hero-modal-title" className="text-base font-semibold text-white">
                  Pexels 이미지 검색 — {modal.nameKr}{' '}
                  <span className="font-mono text-sm font-normal text-slate-400">({modal.code.toUpperCase()})</span>
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Esc로 닫기 · Pexels CDN URL만 저장됩니다.</p>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => closeModal()}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40"
              >
                닫기
              </button>
            </div>

            <div className="space-y-3 px-4 py-3 sm:px-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1 text-xs text-slate-400">
                  검색어
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-600"
                    placeholder="예: Osaka travel"
                    disabled={pexelsLoading || saving}
                  />
                </label>
                <button
                  type="button"
                  disabled={pexelsLoading || saving}
                  onClick={() => void runPexelsSearch()}
                  className="shrink-0 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                >
                  {pexelsLoading ? '검색 중…' : '검색'}
                </button>
              </div>

              {pexelsQuery != null ? (
                <p className="text-xs text-slate-500">
                  마지막 검색어: <span className="font-medium text-slate-300">{pexelsQuery}</span>
                </p>
              ) : null}
              {pexelsError ? <p className="text-xs text-amber-300">{pexelsError}</p> : null}

              {pexelsPhotos.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-400">
                    후보 {pexelsPhotos.length}건 — 사진을 눌러 선택한 뒤 아래에서 저장하세요.
                  </p>
                  <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                    {pexelsPhotos.map((photo) => {
                      const isSel = selected?.id === photo.id
                      return (
                        <button
                          key={photo.id}
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setSelected(photo)
                            setModalFooterMsg(null)
                          }}
                          className={`overflow-hidden rounded-lg border text-left transition ${
                            isSel ? 'border-teal-400 ring-2 ring-teal-500/40' : 'border-slate-600 hover:border-slate-500'
                          } disabled:opacity-50`}
                        >
                          <span className="relative block aspect-video w-full bg-slate-950">
                            <Image
                              src={
                                adminPreviewImgSrc(photo.medium || photo.thumbnail) ??
                                photo.medium ??
                                photo.thumbnail ??
                                ''
                              }
                              alt=""
                              fill
                              className="object-cover"
                              sizes="200px"
                            />
                          </span>
                          <span className="block truncate px-2 py-1 text-[11px] text-slate-400">{photo.photographer}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {!pexelsLoading && pexelsQuery != null && pexelsPhotos.length === 0 && !pexelsError ? (
                <p className="text-xs text-slate-500">결과가 없습니다.</p>
              ) : null}

              {modalFooterMsg ? <p className="text-xs text-amber-300">{modalFooterMsg}</p> : null}

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-700 pt-3 pb-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => closeModal()}
                  className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={saving || !selected}
                  onClick={() => void saveSelectedHero()}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {saving ? '저장 중…' : '히어로로 저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
