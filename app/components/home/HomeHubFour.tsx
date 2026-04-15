import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { MAIN_HUB_FOUR_CARDS, MAIN_HUB_FOUR_SR_HEADING, type HubFourAccent } from '@/lib/main-hub-copy'
import { resolveHomeHubCardHybridImageSrc } from '@/lib/home-hub-resolve-images'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { hubSectionFragmentId } from '@/lib/hub-section-anchor'

export type HomeHubFourProps = {
  overseasHubImageSrc?: string | null
  domesticHubImageSrc?: string | null
}

function hubCardImageSrc(key: HomeHubCardImageKey, props: HomeHubFourProps): string {
  return resolveHomeHubCardHybridImageSrc(key, {
    productPoolOverseasUrl: props.overseasHubImageSrc,
    productPoolDomesticUrl: props.domesticHubImageSrc,
  })
}

const CARD_ROUND = 'rounded-2xl'
const HUB_FOUR_CARD_HEIGHT = 'h-[35rem] min-h-[35rem] max-h-[35rem]'

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

type HubFourCard = (typeof MAIN_HUB_FOUR_CARDS)[number]

function hubPrimaryTitle(card: HubFourCard): string {
  if (card.key === 'training') return TRAINING_PRIMARY_TITLE
  return card.categoryLabel.replace(/\s*\[[^\]]+\]\s*/g, '').trim() || card.categoryLabel
}

function hubHoverSubtitle(card: HubFourCard): string | null {
  if (card.key === 'training') return TRAINING_HOVER_SUBTITLE
  const h = card.headline?.trim()
  return h || null
}

/** 국내·전세: 배경 대비 제목·hover 본문 가독성 강화 */
function isDomesticOrBus(key: HubFourCard['key']): boolean {
  return key === 'domestic' || key === 'bus'
}

export default function HomeHubFour(props: HomeHubFourProps = {}) {
  const cards = MAIN_HUB_FOUR_CARDS.map((card) => ({
    ...card,
    imageSrc: hubCardImageSrc(card.key as HomeHubCardImageKey, props),
  }))

  return (
    <section
      id="hub-four"
      className="relative scroll-mt-20 pb-9 pt-1 sm:scroll-mt-[4.5rem] sm:pb-11 md:pb-12"
      aria-labelledby="home-hub-four-sr-heading"
    >
      <h2 id="home-hub-four-sr-heading" className="sr-only">
        {MAIN_HUB_FOUR_SR_HEADING}
      </h2>

      <div className="mx-auto max-w-6xl px-3 sm:px-5">
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5" role="list">
          {cards.map((card, index) => {
            const key = card.key as HomeHubCardImageKey
            const denseBg = isDomesticOrBus(card.key)
            const primaryTitle = hubPrimaryTitle(card)
            const subtitle = hubHoverSubtitle(card)
            const descFull = card.description?.trim() ?? ''
            const cardAriaLabel = [primaryTitle, subtitle, descFull, ...card.hints, card.ctaLabel]
              .filter(Boolean)
              .join('. ')

            return (
              <li
                key={card.key}
                id={hubSectionFragmentId(card.key)}
                className="relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24"
              >
                <Link
                  href={card.href}
                  aria-label={cardAriaLabel}
                  className={`group relative flex w-full flex-col overflow-hidden border border-bt-border-soft shadow-md shadow-bt-border-soft/40 ring-1 ring-bt-border-soft transition duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/70 lg:hover:-translate-y-0.5 lg:hover:border-bt-border-strong lg:hover:shadow-xl lg:hover:shadow-bt-border-strong/20 lg:hover:ring-bt-border-strong/60 ${CARD_ROUND} ${HUB_FOUR_CARD_HEIGHT}`}
                >
                  <span className="pointer-events-none absolute inset-0 z-0 bg-slate-200" aria-hidden />

                  <Image
                    key={card.imageSrc}
                    src={card.imageSrc}
                    alt=""
                    fill
                    className={`object-cover transition duration-500 ease-out ${hubImagePosition(key)} z-[1] scale-100 lg:group-hover:scale-[1.03] lg:group-focus-within:scale-[1.03]`}
                    sizes="(max-width: 1024px) 50vw, min(600px, calc((min(100vw, 72rem) - 2.5rem) / 2))"
                    quality={92}
                    priority={index < 2}
                    unoptimized={/^https?:\/\//i.test(card.imageSrc)}
                  />

                  {/* 하단 어둡게: 국내·전세는 기본부터 더 진하게 해 제목만 선명 */}
                  <div
                    className={`pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t ${
                      denseBg
                        ? 'from-black/[0.94] via-black/[0.58] to-black/[0.32]'
                        : 'from-black/[0.84] via-black/[0.38] to-black/[0.16]'
                    }`}
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-0 z-[2] bg-black/0 transition-colors duration-300 lg:group-hover:bg-black/40 lg:group-focus-within:bg-black/40"
                    aria-hidden
                  />
                  <div
                    className={`pointer-events-none absolute inset-0 z-[2] bg-gradient-to-br ${accentWash(card.accent)} opacity-[0.16] transition-opacity duration-300 lg:group-hover:opacity-[0.28] lg:group-focus-within:opacity-[0.28]`}
                    aria-hidden
                  />

                  <div className="relative z-[3] flex h-full min-h-0 flex-col justify-end px-4 pb-7 pt-10 text-left sm:px-5 sm:pb-8">
                    {/*
                      부제·설명·태그·CTA: 플로우에서 분리(absolute), 기본 opacity-0 + invisible + translate.
                      hover/focus-within 에만 등장. Link aria-label 로 스크린리더 보완.
                    */}
                    <div
                      aria-hidden
                      className={`
                        max-lg:hidden
                        absolute left-4 right-4 z-[4] flex max-h-[min(52%,18.5rem)] min-h-0 flex-col gap-2.5 overflow-y-auto overscroll-contain rounded-xl p-3
                        translate-y-5 opacity-0
                        transition-[opacity,transform] duration-300 ease-out
                        motion-reduce:transition-none
                        pointer-events-none
                        bottom-[6.75rem] sm:left-5 sm:right-5 sm:bottom-[7rem]
                        bg-black/48 ring-1 ring-white/15 backdrop-blur-md
                        lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-hover:pointer-events-auto
                        lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100 lg:group-focus-within:pointer-events-auto
                        ${denseBg ? 'lg:group-hover:bg-black/72 lg:group-focus-within:bg-black/72 lg:ring-white/22' : 'lg:group-hover:bg-black/58 lg:group-focus-within:bg-black/58'}
                      `}
                    >
                      {subtitle ? (
                        <p
                          className={`text-base font-bold leading-snug text-white sm:text-[1.0625rem] ${
                            denseBg
                              ? 'drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)] drop-shadow-[0_0_12px_rgba(0,0,0,0.85)]'
                              : 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.75)]'
                          }`}
                        >
                          {subtitle}
                        </p>
                      ) : null}
                      {descFull ? (
                        <p
                          className={`text-sm font-semibold leading-relaxed text-white sm:text-[0.9375rem] ${
                            denseBg
                              ? 'drop-shadow-[0_1px_3px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]'
                              : 'drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]'
                          }`}
                        >
                          {descFull}
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {card.hints.map((h) => (
                          <span
                            key={h}
                            className={`rounded-full border px-3 py-2 text-sm font-semibold leading-none text-white shadow-md ${
                              denseBg
                                ? 'border-white/55 bg-black/55 ring-1 ring-white/25 drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]'
                                : 'border-white/50 bg-white/18 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]'
                            }`}
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      <span
                        className={`inline-flex items-center gap-1.5 pt-0.5 text-sm font-bold tracking-tight text-white ${
                          denseBg
                            ? 'drop-shadow-[0_1px_3px_rgba(0,0,0,1)] drop-shadow-[0_0_10px_rgba(0,0,0,0.9)]'
                            : 'drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]'
                        }`}
                      >
                        {card.ctaLabel}
                        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                      </span>
                    </div>

                    {/* 기본·hover 공통: 큰 제목만 플로우 하단에 고정, 항상 opacity 1 */}
                    <p
                      className={`relative z-[5] text-[clamp(2.4rem,3.9vw+1rem,3.55rem)] font-black leading-[1.05] tracking-tight text-white ${
                        denseBg
                          ? 'drop-shadow-[0_3px_0_rgba(0,0,0,0.55)] drop-shadow-[0_4px_20px_rgba(0,0,0,0.75)] drop-shadow-[0_0_28px_rgba(0,0,0,0.55)]'
                          : 'drop-shadow-[0_3px_16px_rgba(0,0,0,0.55)] drop-shadow-[0_0_20px_rgba(0,0,0,0.45)]'
                      }`}
                    >
                      {primaryTitle}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
