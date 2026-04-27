'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { getDefaultHomeHubImagePrompt, type HubImageSeasonKey } from '@/lib/home-hub-image-prompts'

const LAST_PROMPT_KEY = 'bongtour.homeHub.lastGeneratePrompt'

const CARDS: { key: HomeHubCardImageKey; label: string }[] = [
  { key: 'overseas', label: '해외여행' },
  { key: 'training', label: '국외연수' },
  { key: 'domestic', label: '국내여행' },
  { key: 'esim', label: 'eSIM' },
]

const SEASONS: { key: HubImageSeasonKey; label: string }[] = [
  { key: 'default', label: '기본' },
  { key: 'spring', label: '봄' },
  { key: 'summer', label: '여름' },
  { key: 'autumn', label: '가을' },
  { key: 'winter', label: '겨울' },
]

const COUNTS = [2, 4, 6] as const

type Props = {
  onGenerated: () => void
}

type StoredPrompt = { cardKey: HomeHubCardImageKey; season: HubImageSeasonKey; promptText: string }

function readStoredPrompt(): StoredPrompt | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(LAST_PROMPT_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as StoredPrompt
    if (!j?.promptText || !j?.cardKey || !j?.season) return null
    return j
  } catch {
    return null
  }
}

export function HomeHubImageGeneratorPanel({ onGenerated }: Props) {
  const [cardKey, setCardKey] = useState<HomeHubCardImageKey>('overseas')
  const [season, setSeason] = useState<HubImageSeasonKey>('default')
  const [count, setCount] = useState<(typeof COUNTS)[number]>(4)
  const [promptText, setPromptText] = useState(() => getDefaultHomeHubImagePrompt('overseas', 'default'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successHint, setSuccessHint] = useState<string | null>(null)
  const [hasStoredPrompt, setHasStoredPrompt] = useState(false)

  useEffect(() => {
    setHasStoredPrompt(!!readStoredPrompt())
  }, [])

  const defaultForCard = useCallback(
    (k: HomeHubCardImageKey) => getDefaultHomeHubImagePrompt(k, season),
    [season]
  )

  const loadDefault = () => {
    setPromptText(defaultForCard(cardKey))
    setError(null)
  }

  const resetAll = () => {
    setCardKey('overseas')
    setSeason('default')
    setCount(4)
    setPromptText(getDefaultHomeHubImagePrompt('overseas', 'default'))
    setError(null)
  }

  const onCardChange = (k: HomeHubCardImageKey) => {
    setCardKey(k)
    setPromptText(getDefaultHomeHubImagePrompt(k, season))
    setError(null)
    setSuccessHint(null)
  }

  const onSeasonChange = (s: HubImageSeasonKey) => {
    setSeason(s)
    setPromptText(getDefaultHomeHubImagePrompt(cardKey, s))
    setError(null)
    setSuccessHint(null)
  }

  const loadLastGeneratePrompt = () => {
    const s = readStoredPrompt()
    if (!s) return
    setPromptText(s.promptText)
    setCardKey(s.cardKey)
    setSeason(s.season)
    setSuccessHint('직전 생성에 사용한 프롬프트·카드·시즌을 불러왔습니다. 수정 후 다시 생성할 수 있습니다.')
    setError(null)
  }

  const generate = async () => {
    setLoading(true)
    setError(null)
    setSuccessHint(null)
    try {
      const res = await fetch('/api/admin/home-hub-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardKey, season, promptText, count }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        items?: unknown[]
      }
      if (!res.ok || !data.ok) {
        if (res.status === 401) {
          setError('로그인이 만료되었거나 권한이 없습니다. 다시 로그인한 뒤 시도하세요.')
        } else if (res.status === 400) {
          setError(data.error || '입력값을 확인하세요. 카드·시즌·프롬프트·생성 개수(2/4/6)가 올바른지 봅니다.')
        } else {
          setError(
            data.error ||
              `이미지 생성에 실패했습니다(HTTP ${res.status}). GEMINI_API_KEY·쿼터·네트워크를 확인하세요. 스텁으로 저장되지 않았다면 서버 로그를 참고하세요.`
          )
        }
        return
      }
      const n = Array.isArray(data.items) ? data.items.length : count
      try {
        sessionStorage.setItem(
          LAST_PROMPT_KEY,
          JSON.stringify({ cardKey, season, promptText } satisfies StoredPrompt)
        )
        setHasStoredPrompt(true)
      } catch {
        /* storage full / private mode */
      }
      setSuccessHint(
        `후보 ${n}장이 public/data/home-hub-candidates.json 에 추가되었습니다. 아래 갤러리에서 스텁/제미나이 여부를 확인한 뒤 활성화하세요.`
      )
      onGenerated()
    } catch {
      setError(
        '브라우저에서 서버에 연결하지 못했습니다. 네트워크·VPN·개발 서버(npm run dev) 실행 여부를 확인하세요.'
      )
    } finally {
      setLoading(false)
    }
  }

  const selectClass =
    'mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500'

  const hint = useMemo(
    () => '제미나이 키가 없거나 API가 실패하면 base 이미지를 복사한 스텁 후보가 저장됩니다.',
    []
  )

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/80 p-5">
      <h2 className="text-sm font-semibold text-slate-200">후보 생성</h2>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      <p className="mt-1 text-xs text-slate-600">
        카드 또는 시즌을 바꾸면 프롬프트가 해당 조합의 <span className="text-slate-400">기본 문구</span>로 자동
        바뀝니다. 직접 수정한 내용은 덮어씌워집니다.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block text-xs text-slate-400">
          카드
          <select
            className={selectClass}
            value={cardKey}
            onChange={(e) => onCardChange(e.target.value as HomeHubCardImageKey)}
            disabled={loading}
          >
            {CARDS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          시즌
          <select
            className={selectClass}
            value={season}
            onChange={(e) => onSeasonChange(e.target.value as HubImageSeasonKey)}
            disabled={loading}
          >
            {SEASONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          생성 개수
          <select
            className={selectClass}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) as (typeof COUNTS)[number])}
            disabled={loading}
          >
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}장
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block text-xs text-slate-400">
        프롬프트
        <textarea
          className="mt-1 min-h-[120px] w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          disabled={loading}
        />
      </label>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={loadDefault}
          disabled={loading}
          className="rounded-lg border-2 border-teal-500/70 bg-teal-950/40 px-3 py-2 text-xs font-medium text-teal-100 shadow-sm shadow-teal-900/30 hover:bg-teal-900/50 disabled:opacity-50"
        >
          기본 프롬프트로 맞추기
        </button>
        {hasStoredPrompt ? (
          <button
            type="button"
            onClick={loadLastGeneratePrompt}
            disabled={loading}
            className="rounded-lg border border-slate-500 bg-slate-800/80 px-3 py-2 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            직전 생성에 쓴 프롬프트 불러오기
          </button>
        ) : null}
        <button
          type="button"
          onClick={resetAll}
          disabled={loading}
          className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          폼 초기화
        </button>
        <button
          type="button"
          onClick={generate}
          disabled={loading || !promptText.trim()}
          className="rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
        >
          {loading ? '생성 중…' : '생성'}
        </button>
      </div>

      {successHint ? (
        <p className="mt-3 rounded-lg border border-teal-500/40 bg-teal-950/30 px-3 py-2 text-sm text-teal-100/95">
          {successHint}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-500/35 bg-red-950/25 px-3 py-2 text-sm leading-relaxed text-red-200">
          {error}
        </p>
      ) : null}
    </section>
  )
}
