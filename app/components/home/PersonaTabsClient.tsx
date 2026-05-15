'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import HomeHubPhotoPlaceholder from '@/app/components/home/HomeHubPhotoPlaceholder'
import {
  PERSONA_TAB_KEYS,
  PERSONA_TAB_LABELS,
  type PersonaTabKey,
} from '@/lib/main-hub-copy'
import type { PersonaCityCard } from '@/lib/persona-curated-destinations'
import { HUB_FOUR_PHOTO_CARD_HOVER_RING_CLASS } from '@/lib/home-hub-four-accent-classes'

const PHOTO_FILTER_BASE =
  'transition-[filter] duration-200 ease-out [filter:brightness(0.55)_contrast(1.05)] group-hover:[filter:brightness(0.7)_contrast(1.05)]'

type Props = { cards: PersonaCityCard[] }

function filterCards(tab: PersonaTabKey, cards: PersonaCityCard[]): PersonaCityCard[] {
  if (tab === 'all') return cards
  if (tab === 'with-parents') return cards.filter((c) => c.withParents)
  if (tab === 'with-kids') return cards.filter((c) => c.withKids)
  return cards.filter((c) => c.couple)
}

export default function PersonaTabsClient({ cards }: Props) {
  const [tab, setTab] = useState<PersonaTabKey>('all')
  const visible = useMemo(() => filterCards(tab, cards), [tab, cards])

  return (
    <div className="mt-8">
      <div
        className="flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-bt-border-soft/60 bg-white/80 px-2 py-2 shadow-sm sm:gap-2.5 sm:px-3"
        role="tablist"
        aria-label="추천 여행지 페르소나"
      >
        {PERSONA_TAB_KEYS.map((key, i) => {
          const active = tab === key
          const label = PERSONA_TAB_LABELS[i] ?? key
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={`rounded-full px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
                active
                  ? 'bg-bt-text-navy text-white shadow-md ring-2 ring-[#d9a81e]/90'
                  : 'bg-white text-bt-text-navy ring-1 ring-bt-border-soft/80 hover:ring-[#d9a81e]/50'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 text-center text-sm text-bt-text-muted-lavender">
          이 주기에서 선택된 도시 중, 이 성향 라벨이 붙은 상품이 있는 도시가 없습니다. 다른 탭을 눌러 보세요.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {visible.map((card, index) => {
            const pending = !card.imageUrl?.trim()
            const hubImageUnoptimized = card.imageUrl ? /^https?:\/\//i.test(card.imageUrl) : false
            const href = `/travel/overseas?destination=${encodeURIComponent(card.cityKey)}`
            const aria = [`${card.titleEn} ${card.koreanSubtitle}`, '해외여행 상품 보기'].filter(Boolean).join('. ')
            return (
              <li key={card.cityKey} className="relative min-w-0">
                <Link
                  href={href}
                  aria-label={aria}
                  className={`group relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-md ${HUB_FOUR_PHOTO_CARD_HOVER_RING_CLASS}`}
                >
                  {pending ? (
                    <HomeHubPhotoPlaceholder />
                  ) : (
                    <>
                      <div className="absolute inset-0 z-[1] overflow-hidden rounded-2xl">
                        <div className={`absolute inset-0 z-0 ${PHOTO_FILTER_BASE}`}>
                          <SafeImage
                            src={card.imageUrl!}
                            alt=""
                            fill
                            className="object-cover object-center"
                            sizes="(max-width:1024px) 50vw, 20vw"
                            quality={75}
                            priority={index === 0}
                            loading={index === 0 ? undefined : 'lazy'}
                            unoptimized={hubImageUnoptimized}
                          />
                        </div>
                      </div>
                      <div
                        className="pointer-events-none absolute inset-0 z-[2] bg-[rgba(0,0,0,0.35)]"
                        aria-hidden
                      />
                    </>
                  )}
                  <div className="relative z-[3] mt-auto flex flex-col justify-end px-3 pb-5 pt-16 text-left sm:px-4 sm:pb-6">
                    <p className="text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
                      {card.titleEn}
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
                      {card.koreanSubtitle}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
