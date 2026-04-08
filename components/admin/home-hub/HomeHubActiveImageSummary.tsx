'use client'

import Image from 'next/image'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { homeHubCardImageSrc } from '@/lib/home-hub-images'
import type { HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'

const KEYS: HomeHubCardImageKey[] = ['overseas', 'training', 'domestic', 'bus']

type Props = {
  cardLabels: Record<HomeHubCardImageKey, string>
  active: HomeHubActiveClientModel | null
}

export function HomeHubActiveImageSummary({ cardLabels, active }: Props) {
  const season =
    active?.activeSeason?.trim() ||
    (active?.season === 'base' ? 'default' : active?.season?.trim()) ||
    'default'
  const lastAt = active?.lastUpdatedAt
    ? new Date(active.lastUpdatedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
    : '—'

  return (
    <section className="rounded-xl border-2 border-teal-900/50 bg-slate-900/80 p-5 shadow-inner shadow-teal-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-teal-100/95">현재 메인에 적용 중인 4장</h2>
          <p className="mt-1 text-xs text-slate-500">
            아래 썸네일은 <code className="text-slate-400">home-hub-active.json</code> 기준이며, 방문자 메인
            허브와 동일한 URL입니다.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            운영 시즌: <span className="font-medium text-slate-300">{season}</span>
            {' · '}
            마지막 반영: <span className="font-medium text-slate-300">{lastAt}</span>
            {active?.lastUpdatedBy ? (
              <>
                {' · '}
                <span className="text-slate-400">by {active.lastUpdatedBy}</span>
              </>
            ) : null}
          </p>
        </div>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-teal-500/60 bg-teal-950/50 px-3 py-2 text-xs font-semibold text-teal-100 hover:bg-teal-900/60"
        >
          메인 페이지에서 확인
        </a>
      </div>
      {!active ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-3 text-sm leading-relaxed text-amber-100/90">
          <p className="font-medium text-amber-100">활성 설정 파일이 없습니다.</p>
          <p className="mt-1 text-xs text-amber-200/80">
            <code className="text-amber-200/90">public/data/home-hub-active.json</code> 이 없으면 사용자
            메인은 시즌별 기본 이미지 경로로 폴백합니다. 후보를 활성화하면 이 파일이 생성·갱신됩니다.
          </p>
        </div>
      ) : null}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {KEYS.map((key) => {
          const configured = active?.images?.[key]?.trim()
          const fallback = homeHubCardImageSrc(key)
          const src = configured || fallback
          const fromJson = Boolean(configured)
          return (
            <li
              key={key}
              className="overflow-hidden rounded-lg border-2 border-teal-800/40 bg-slate-950/40 ring-1 ring-teal-500/15"
            >
              <div className="relative aspect-[16/9] w-full bg-slate-800">
                <div className="absolute left-2 top-2 z-10 rounded border border-teal-500/50 bg-slate-950/90 px-2 py-0.5 text-[10px] font-bold text-teal-200">
                  메인 노출
                </div>
                <Image
                  src={src}
                  alt={cardLabels[key]}
                  fill
                  className="object-cover"
                  sizes="(max-width:640px) 100vw, 50vw"
                  unoptimized={src.startsWith('http')}
                />
              </div>
              <div className="space-y-1 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-slate-200">{cardLabels[key]}</span>
                  {!fromJson ? (
                    <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      JSON 없음 → 폴백
                    </span>
                  ) : null}
                </div>
                <code className="block break-all text-[11px] text-teal-300/90">{src}</code>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
