'use client'

import SafeImage from '@/app/components/SafeImage'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import type { HubFourAccent } from '@/lib/main-hub-copy'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { hubSectionFragmentId } from '@/lib/hub-section-anchor'
import {
  HUB_FOUR_V5_HOVER_RING_CLASS,
  hubFourAccentCardSurfaceClass,
} from '@/lib/home-hub-four-accent-classes'

export type HomeHubFourClientCardModel = {
  key: string
  imageKey: HomeHubCardImageKey
  href: string
  accent: HubFourAccent
  categoryLabel: string
  headline: string
  titleEn: string
  description: string
  hints: readonly string[]
  ctaLabel: string
  imageSrc: string
}

function hubImagePosition(key: HomeHubCardImageKey): string {
  switch (key) {
    case 'overseas':
      return 'object-[center_32%]'
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

type Props = { card: HomeHubFourClientCardModel; index: number }

/**
 * v5 시안 — 색면이 메인, 하단에 사진 슬롯. 텍스트는 다크 네이비·라벤더 뮤트(메모리 #27).
 */
export default function HomeHubFourClientCard({ card, index }: Props) {
  const titlePairKo = card.categoryLabel
  const subtitle = card.headline?.trim() ?? ''
  const descFull = card.description?.trim() ?? ''
  const cardAriaLabel = [titlePairKo, card.titleEn, subtitle, descFull, ...card.hints, card.ctaLabel]
    .filter(Boolean)
    .join('. ')
  const hubImageUnoptimized = /^https?:\/\//i.test(card.imageSrc)

  return (
    <li id={hubSectionFragmentId(card.key)} className={`relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24 ${CARD_ROUND}`}>
      <Link
        href={card.href}
        aria-label={cardAriaLabel}
        className={`group relative flex min-h-[13.5rem] w-full flex-col overflow-hidden shadow-sm ring-0 ring-transparent ${CARD_ROUND} ${hubFourAccentCardSurfaceClass(card.accent)} ${HUB_FOUR_V5_HOVER_RING_CLASS}`}
      >
        <div className="relative z-[2] flex flex-1 flex-col items-center justify-center px-3 pb-2 pt-5 text-center sm:px-4 sm:pt-6">
          <h3 className="text-lg font-bold tracking-tight text-bt-text-navy sm:text-xl">{titlePairKo}</h3>
          {subtitle ? (
            <p className="mt-1.5 max-w-[14rem] text-xs font-semibold leading-snug text-bt-text-muted-lavender sm:text-sm">
              {subtitle}
            </p>
          ) : null}
          <p className="mt-1 text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-bt-text-navy/55 [font-family:var(--font-hub-outfit),ui-sans-serif,system-ui,sans-serif] sm:text-xs">
            {card.titleEn}
          </p>
        </div>

        <div className={`relative z-[1] mt-auto h-[4.25rem] w-full shrink-0 overflow-hidden sm:h-[4.75rem] ${CARD_ROUND}`}>
          <span className="pointer-events-none absolute inset-0 z-[0] bg-black/[0.04]" aria-hidden />
          <SafeImage
            key={card.imageSrc}
            src={card.imageSrc}
            alt=""
            fill
            className={`object-cover opacity-[0.42] saturate-[0.88] transition duration-300 ease-out group-hover:opacity-[0.52] ${hubImagePosition(card.imageKey)}`}
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
          <div
            className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/[0.12] via-transparent to-[color-mix(in_srgb,var(--bt-bg-lavender-soft)_55%,transparent)]"
            aria-hidden
          />
        </div>

        <span className="sr-only">
          {descFull} {card.hints.join(', ')} {card.ctaLabel}
        </span>
        <span
          className="pointer-events-none absolute bottom-2 right-2 z-[3] inline-flex items-center gap-0.5 rounded-full bg-white/80 px-2 py-0.5 text-[0.625rem] font-bold text-bt-text-navy/80 opacity-0 shadow-sm ring-1 ring-bt-border-soft/50 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 sm:text-xs"
          aria-hidden
        >
          {card.ctaLabel}
          <ArrowUpRight className="h-3 w-3 shrink-0" aria-hidden />
        </span>
      </Link>
    </li>
  )
}
