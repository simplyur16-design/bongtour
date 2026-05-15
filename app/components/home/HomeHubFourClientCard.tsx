'use client'

import SafeImage from '@/app/components/SafeImage'
import Link from 'next/link'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { hubSectionFragmentId } from '@/lib/hub-section-anchor'
import HomeHubPhotoPlaceholder from '@/app/components/home/HomeHubPhotoPlaceholder'
import { HUB_FOUR_PHOTO_CARD_HOVER_RING_CLASS } from '@/lib/home-hub-four-accent-classes'

export type HomeHubFourClientCardModel = {
  key: string
  imageKey: HomeHubCardImageKey
  href: string
  categoryLabel: string
  headline: string
  titleEn: string
  description: string
  hints: readonly string[]
  ctaLabel: string
  imageSrc: string
  imagePending: boolean
}

function hubImagePosition(key: HomeHubCardImageKey): string {
  switch (key) {
    case 'overseas':
      return 'object-[center_30%]'
    case 'training':
      return 'object-[center_38%]'
    case 'domestic':
      return 'object-[center_35%]'
    case 'esim':
      return 'object-[center_32%]'
    default:
      return 'object-center'
  }
}

const CARD_ROUND = 'rounded-2xl'
const CARD_MIN_H = 'min-h-[18rem] sm:min-h-[20rem] lg:min-h-[22rem]'

/** 사진 레이어 — 메모리 #27 SSOT: 밝은 베이스 + 하단 그라데이션만(전면 딤 제거) */
const PHOTO_FILTER_BASE =
  'transition-[filter] duration-200 ease-out [filter:brightness(0.92)_saturate(1.08)] group-hover:[filter:brightness(1.0)_saturate(1.15)]'

type Props = { card: HomeHubFourClientCardModel; index: number }

export default function HomeHubFourClientCard({ card, index }: Props) {
  const descFull = card.description?.trim() ?? ''
  const cardAriaLabel = [card.categoryLabel, card.titleEn, card.headline, descFull, ...card.hints, card.ctaLabel]
    .filter(Boolean)
    .join('. ')
  const hubImageUnoptimized = /^https?:\/\//i.test(card.imageSrc)

  return (
    <li id={hubSectionFragmentId(card.key)} className="relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24">
      <Link
        href={card.href}
        aria-label={cardAriaLabel}
        className={`group relative flex w-full flex-col overflow-hidden border border-bt-border-soft/80 shadow-md ${CARD_ROUND} ${CARD_MIN_H} ${HUB_FOUR_PHOTO_CARD_HOVER_RING_CLASS}`}
      >
        {card.imagePending ? (
          <HomeHubPhotoPlaceholder />
        ) : (
          <>
            <div className={`absolute inset-0 z-[1] overflow-hidden ${CARD_ROUND}`}>
              <div className={`absolute inset-0 z-0 ${PHOTO_FILTER_BASE}`}>
                <SafeImage
                  key={card.imageSrc}
                  src={card.imageSrc}
                  alt=""
                  fill
                  className={`object-cover ${hubImagePosition(card.imageKey)}`}
                  sizes={
                    index === 0
                      ? '(max-width: 1280px) 50vw, 600px'
                      : '(max-width:768px) 100vw, (max-width:1024px) 50vw, 25vw'
                  }
                  quality={index === 0 ? 80 : 75}
                  priority={index === 0}
                  fetchPriority={index === 0 ? 'high' : 'low'}
                  loading={index === 0 ? undefined : 'lazy'}
                  unoptimized={hubImageUnoptimized}
                />
              </div>
            </div>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-2/3 bg-gradient-to-t from-black/65 via-black/20 to-transparent"
              aria-hidden
            />
          </>
        )}

        <div className="relative z-[3] flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 text-center sm:py-10">
          <h3 className="text-2xl font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)] sm:text-[28px]">
            {card.categoryLabel}
          </h3>
          {card.headline ? (
            <p className="mt-2 max-w-[20ch] text-sm leading-snug text-white/90 drop-shadow-[0_1px_8px_rgba(0,0,0,0.45)]">
              {card.headline}
            </p>
          ) : null}
        </div>
      </Link>
    </li>
  )
}
