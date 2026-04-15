'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useCallback, useState, type FocusEvent } from 'react'
import type { HubFourAccent } from '@/lib/main-hub-copy'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { hubSectionFragmentId } from '@/lib/hub-section-anchor'

export type HomeHubFourClientCardModel = {
  key: HomeHubCardImageKey
  href: string
  accent: HubFourAccent
  categoryLabel: string
  headline: string
  description: string
  hints: readonly string[]
  ctaLabel: string
  imageSrc: string
}

const TRAINING_PRIMARY_TITLE = '국외연수'
const TRAINING_HOVER_SUBTITLE = '목적형 연수 설계'

function accentWash(accent: HubFourAccent): string {
  switch (accent) {
    case 'overseas':
      return 'from-[color-mix(in_srgb,var(--bt-brand-blue)_22%,transparent)] via-transparent to-transparent'
    case 'training':
      return 'from-[color-mix(in_srgb,var(--bt-brand-gold)_18%,transparent)] via-transparent to-transparent'
    case 'domestic':
      return 'from-[color-mix(in_srgb,var(--bt-success)_14%,transparent)] via-transparent to-transparent'
    case 'bus':
      return 'from-[color-mix(in_srgb,var(--bt-text-muted)_12%,transparent)] via-transparent to-transparent'
  }
}

function hubImagePosition(key: HomeHubCardImageKey): string {
  switch (key) {
    case 'overseas':
      return 'object-[center_30%]'
    case 'training':
      return 'object-[center_38%]'
    case 'domestic':
      return 'object-[center_35%]'
    case 'bus':
      return 'object-[center_32%]'
    default:
      return 'object-center'
  }
}

function hubPrimaryTitle(card: HomeHubFourClientCardModel): string {
  if (card.key === 'training') return TRAINING_PRIMARY_TITLE
  return card.categoryLabel.replace(/\s*\[[^\]]+\]\s*/g, '').trim() || card.categoryLabel
}

function hubHoverSubtitle(card: HomeHubFourClientCardModel): string | null {
  if (card.key === 'training') return TRAINING_HOVER_SUBTITLE
  const h = card.headline?.trim()
  return h || null
}

function isDomesticOrBus(key: HomeHubCardImageKey): boolean {
  return key === 'domestic' || key === 'bus'
}

const CARD_ROUND = 'rounded-2xl'
const HUB_FOUR_CARD_HEIGHT = 'h-[35rem] min-h-[35rem] max-h-[35rem]'

type Props = { card: HomeHubFourClientCardModel; index: number }

export default function HomeHubFourClientCard({ card, index }: Props) {
  const key = card.key
  const denseBg = isDomesticOrBus(key)
  const primaryTitle = hubPrimaryTitle(card)
  const subtitle = hubHoverSubtitle(card)
  const descFull = card.description?.trim() ?? ''
  const [detailOpen, setDetailOpen] = useState(false)

  const cardAriaLabel = [primaryTitle, subtitle, descFull, ...card.hints, card.ctaLabel].filter(Boolean).join('. ')

  const open = useCallback(() => setDetailOpen(true), [])
  const close = useCallback(() => setDetailOpen(false), [])

  const onBlurLink = useCallback((e: FocusEvent<HTMLAnchorElement>) => {
    const next = e.relatedTarget as Node | null
    if (next && e.currentTarget.contains(next)) return
    setDetailOpen(false)
  }, [])

  /** 기본은 사진이 더 밝게 보이도록; 국내·버스만 살짝 더 스크림 */
  const baseGradient = denseBg
    ? 'from-black/[0.52] via-black/[0.22] to-black/[0.06]'
    : 'from-black/[0.42] via-black/[0.14] to-transparent'

  return (
    <li id={hubSectionFragmentId(card.key)} className="relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24">
      <Link
        href={card.href}
        aria-label={cardAriaLabel}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={onBlurLink}
        className={`relative flex w-full flex-col overflow-hidden border border-bt-border-soft shadow-md shadow-bt-border-soft/40 ring-1 ring-bt-border-soft transition duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/70 lg:hover:-translate-y-0.5 lg:hover:border-bt-border-strong lg:hover:shadow-xl lg:hover:shadow-bt-border-strong/20 lg:hover:ring-bt-border-strong/60 ${CARD_ROUND} ${HUB_FOUR_CARD_HEIGHT}`}
      >
        <span className="pointer-events-none absolute inset-0 z-0 bg-slate-200" aria-hidden />

        <Image
          key={card.imageSrc}
          src={card.imageSrc}
          alt=""
          fill
          className={`object-cover transition duration-500 ease-out ${hubImagePosition(key)} z-[1] ${detailOpen ? 'scale-[1.03] brightness-[1.04]' : 'scale-100 brightness-100'}`}
          sizes="(max-width: 1024px) 50vw, min(600px, calc((min(100vw, 72rem) - 2.5rem) / 2))"
          quality={92}
          priority={index < 2}
          unoptimized={/^https?:\/\//i.test(card.imageSrc)}
        />

        <div className={`pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t ${baseGradient}`} aria-hidden />
        <div
          className={`pointer-events-none absolute inset-0 z-[2] transition-colors duration-300 ${detailOpen ? 'bg-black/[0.14]' : 'bg-transparent'}`}
          aria-hidden
        />
        <div
          className={`pointer-events-none absolute inset-0 z-[2] bg-gradient-to-br ${accentWash(card.accent)} transition-opacity duration-300 ${detailOpen ? 'opacity-[0.22]' : 'opacity-[0.09]'}`}
          aria-hidden
        />

        <div className="relative z-[3] h-full min-h-0">
          {detailOpen ? (
            <div
              className={`absolute inset-x-4 top-[30%] bottom-24 z-[4] flex max-h-none min-h-0 flex-col items-center gap-2.5 overflow-y-auto overscroll-contain px-2 py-2 text-center backdrop-blur-[2px] sm:inset-x-5 ${
                denseBg ? 'bg-black/32' : 'bg-black/28'
              }`}
            >
              {subtitle ? (
                <p className="inline-block max-w-full rounded-md bg-black/45 px-3 py-1.5 text-base font-bold leading-snug text-white ring-1 ring-white/22 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:text-[1.0625rem]">
                  {subtitle}
                </p>
              ) : null}
              {descFull ? (
                <p className="w-full rounded-lg bg-black/45 px-3 py-2.5 text-sm font-semibold leading-relaxed text-white ring-1 ring-white/18 drop-shadow-md sm:text-[0.9375rem]">
                  {descFull}
                </p>
              ) : null}
              <div className="flex w-full flex-wrap justify-center gap-2">
                {card.hints.map((h) => (
                  <span
                    key={h}
                    className="rounded-full border border-white/50 bg-white/14 px-3 py-2 text-sm font-semibold leading-none text-white shadow-md backdrop-blur-sm"
                  >
                    {h}
                  </span>
                ))}
              </div>
              <span className="inline-flex items-center justify-center gap-1.5 pt-0.5 text-sm font-bold tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                {card.ctaLabel}
                <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
              </span>
            </div>
          ) : null}

          <p
            className={`absolute left-4 right-4 z-[6] text-center text-[clamp(2.4rem,3.9vw+1rem,3.55rem)] font-black leading-[1.05] tracking-tight text-white transition-[top,transform] duration-300 ease-out sm:left-5 sm:right-5 lg:tracking-[-0.01em] ${
              detailOpen ? 'top-12 translate-y-0 sm:top-14' : 'top-1/2 -translate-y-1/2'
            } ${
              denseBg
                ? 'drop-shadow-[0_2px_0_rgba(0,0,0,0.4)] drop-shadow-[0_4px_18px_rgba(0,0,0,0.5)]'
                : 'drop-shadow-[0_2px_14px_rgba(0,0,0,0.45)] drop-shadow-[0_0_16px_rgba(0,0,0,0.35)]'
            }`}
          >
            {primaryTitle}
          </p>
        </div>
      </Link>
    </li>
  )
}
