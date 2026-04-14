import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { MAIN_HUB_FOUR_CARDS, MAIN_HUB_FOUR_SR_HEADING, type HubFourAccent } from '@/lib/main-hub-copy'
import { resolveHomeHubCardHybridImageSrc } from '@/lib/home-hub-resolve-images'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { hubSectionFragmentId } from '@/lib/hub-section-anchor'

export type HomeHubFourProps = {
  /** 해외여행 카드: 상품 풀에서 고른 대표 커버 URL(`resolveHomeHubCardHybridImageSrc` 2순위) */
  overseasHubImageSrc?: string | null
  /** 국내여행 카드: 상품 풀에서 고른 대표 커버 URL(`resolveHomeHubCardHybridImageSrc` 2순위) */
  domesticHubImageSrc?: string | null
}

function hubCardImageSrc(key: HomeHubCardImageKey, props: HomeHubFourProps): string {
  return resolveHomeHubCardHybridImageSrc(key, {
    productPoolOverseasUrl: props.overseasHubImageSrc,
    productPoolDomesticUrl: props.domesticHubImageSrc,
  })
}

const CARD_ROUND = 'rounded-2xl'
const IMAGE_AREA =
  'relative block w-full overflow-hidden aspect-[10/13] min-h-[200px] sm:min-h-[220px] md:aspect-[16/10] md:min-h-[240px] lg:min-h-[260px]'

/**
 * 카테고리 힌트만 살짝 — 기본은 거의 보이지 않게, hover 시에만 살짝 강조.
 */
function accentWash(accent: HubFourAccent): string {
  switch (accent) {
    case 'overseas':
      return 'from-[color-mix(in_srgb,var(--bt-brand-blue)_18%,transparent)] via-transparent to-transparent'
    case 'training':
      return 'from-[color-mix(in_srgb,var(--bt-brand-gold)_14%,transparent)] via-transparent to-transparent'
    case 'domestic':
      return 'from-[color-mix(in_srgb,var(--bt-success)_12%,transparent)] via-transparent to-transparent'
    case 'bus':
      return 'from-[color-mix(in_srgb,var(--bt-text-muted)_10%,transparent)] via-transparent to-transparent'
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
            return (
              <li
                key={card.key}
                id={hubSectionFragmentId(card.key)}
                className="relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24"
              >
                <Link
                  href={card.href}
                  className={`group flex flex-col overflow-hidden border border-bt-border-soft bg-white shadow-md shadow-bt-border-soft/40 ring-1 ring-bt-border-soft transition duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/70 ${CARD_ROUND} md:hover:-translate-y-1 md:hover:border-bt-border-strong md:hover:shadow-xl md:hover:shadow-bt-border-strong/20 md:hover:ring-bt-border-strong/60`}
                >
                  <div className={`${IMAGE_AREA} border-b border-bt-border-soft`}>
                    <Image
                      key={card.imageSrc}
                      src={card.imageSrc}
                      alt=""
                      fill
                      className={`object-cover transition duration-500 ease-out ${hubImagePosition(card.key as HomeHubCardImageKey)}`}
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, min(600px, calc((min(100vw, 72rem) - 2.5rem) / 2))"
                      quality={92}
                      priority={index < 2}
                      unoptimized={/^https?:\/\//i.test(card.imageSrc)}
                    />
                    <div
                      className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentWash(card.accent)} opacity-[0.18] transition-opacity duration-300 md:group-hover:opacity-[0.32] md:group-focus-within:opacity-[0.32]`}
                      aria-hidden
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 px-3 py-3 sm:px-4 sm:py-4">
                    <p className="text-base font-bold leading-tight text-bt-title sm:text-lg">{card.categoryLabel}</p>
                    <p className="text-sm font-semibold text-bt-body">{card.headline}</p>
                    <p className="line-clamp-2 text-xs leading-relaxed text-bt-muted">{card.description}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {card.hints.map((h) => (
                        <span
                          key={h}
                          className="rounded-full border border-bt-border-soft bg-bt-surface-soft px-2 py-0.5 text-[10px] font-medium text-bt-meta"
                        >
                          {h}
                        </span>
                      ))}
                    </div>
                    <span className="mt-2 flex items-center gap-1 text-xs font-semibold text-bt-link sm:text-sm">
                      {card.ctaLabel}
                      <ArrowUpRight className="h-4 w-4" aria-hidden />
                    </span>
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
