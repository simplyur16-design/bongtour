'use client'

import { isScheduleUserPlaceholder } from '@/lib/public-schedule-display'

type Props = {
  description: string
  className?: string
}

function extractRouteTokens(description: string): string[] | null {
  const raw = (description ?? '').replace(/\r/g, '\n').trim()
  if (!raw) return null
  if (isScheduleUserPlaceholder(raw)) return null

  // 공급사 포맷이 "장소, 장소, 장소" 형태인 경우를 우선 처리
  const normalized = raw.replace(/[，]/g, ',')

  const commaTokens = normalized
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !isScheduleUserPlaceholder(s))

  // 이미 하이픈 연결 형태라면 그걸 토큰화
  if (commaTokens.length >= 2) return commaTokens

  if (/ - /.test(normalized) || /-\s*/.test(normalized)) {
    const dashTokens = normalized
      .split(/\s*-\s*/)
      .map((s) => s.trim())
      .filter((s) => s && !isScheduleUserPlaceholder(s))
    if (dashTokens.length >= 2) return dashTokens
  }

  return null
}

/** 테마 토큰/상속에 의존하지 않음 — 밝은 카드에서도 항상 짙은 본문색 (tailwind ! 우선) */
function placeToneClass(i: number): string {
  if (i % 6 === 4) return '!text-sky-900 font-semibold dark:!text-sky-100'
  const pick = i % 3
  if (pick === 0) return '!text-slate-900 font-semibold dark:!text-slate-100'
  if (pick === 1) return '!text-slate-800 font-semibold dark:!text-slate-200'
  return '!text-slate-800 font-medium dark:!text-slate-200'
}

export default function ItineraryRouteSummaryLine({ description, className = '' }: Props) {
  const rawDesc = (description ?? '').replace(/\r/g, '\n').trim()
  if (!rawDesc || isScheduleUserPlaceholder(rawDesc)) return null

  const tokens = extractRouteTokens(description)
  if (!tokens || tokens.length === 0) {
    const firstLine =
      rawDesc
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l && !isScheduleUserPlaceholder(l)) ?? ''
    if (!firstLine) return null
    return (
      <p
        className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed !text-slate-900 dark:!text-slate-100 ${className}`}
      >
        {firstLine}
      </p>
    )
  }

  // 동선 요약줄: "장소 - 장소 - 장소" 흐름으로 빠르게 읽히게
  return (
    <div className={`mt-2 ${className}`}>
      <div className="flex flex-wrap items-baseline gap-y-1">
        {tokens.map((t, i) =>
          i === 0 ? (
            <span key={i} className={`text-sm leading-relaxed sm:text-base ${placeToneClass(i)}`}>
              {t}
            </span>
          ) : (
            <span key={i} className="inline-flex items-baseline">
              <span className="!text-slate-600 text-sm leading-relaxed sm:text-base font-medium dark:!text-slate-400">
                {' - '}
              </span>
              <span className={`text-sm leading-relaxed sm:text-base ${placeToneClass(i)}`}>{t}</span>
            </span>
          )
        )}
      </div>
    </div>
  )
}
