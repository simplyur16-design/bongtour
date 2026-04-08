import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { MAIN_HUB_FOUR_CARDS, MAIN_HUB_FOUR_SR_HEADING, type HubFourAccent } from '@/lib/main-hub-copy'
import { resolveHomeHubImageSrc } from '@/lib/home-hub-resolve-images'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import { hubSectionFragmentId } from '@/lib/hub-section-anchor'

const CARD_ROUND = 'rounded-2xl'
const CARD_ASPECT =
  'relative block aspect-[10/13] min-h-[220px] overflow-hidden sm:min-h-[240px] md:aspect-[16/10] md:min-h-[300px] lg:min-h-[320px]'

/**
 * 카테고리 힌트만 살짝 — 기본은 거의 보이지 않게, hover 시에만 살짝 강조.
 * (과한 컬러 워시 + 높은 opacity는 사진을 뿌옇게 만듦)
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

/** 카드별 피사체가 잘 보이도록 object-position 보정 */
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

/**
 * 메인 허브 4카드 — 기본: 사진 우선·얕은 틴트·하단 그라데이션만.
 * hover(md+): 전면 스크림·하단 밴드 강화 + 부가 카피·lift.
 */
export default function HomeHubFour() {
  const cards = MAIN_HUB_FOUR_CARDS.map((card) => ({
    ...card,
    imageSrc: resolveHomeHubImageSrc(card.key as HomeHubCardImageKey),
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
          {cards.map((card, index) => (
            <li
              key={card.key}
              id={hubSectionFragmentId(card.key)}
              className="relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24"
            >
              <Link
                href={card.href}
                className={`group ${CARD_ASPECT} block border border-bt-border-soft bg-white shadow-md shadow-bt-border-soft/40 ring-1 ring-bt-border-soft transition duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/70 ${CARD_ROUND} md:hover:-translate-y-2 md:hover:border-bt-border-strong md:hover:shadow-xl md:hover:shadow-bt-border-strong/20 md:hover:ring-bt-border-strong/60`}
              >
                <Image
                  src={card.imageSrc}
                  alt=""
                  fill
                  className={`object-cover transition duration-500 ease-out md:group-hover:scale-[1.03] md:group-focus-within:scale-[1.03] ${hubImagePosition(card.key as HomeHubCardImageKey)}`}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, (max-width: 1536px) 480px, 520px"
                  quality={92}
                  priority={index < 2}
                />
                {/* 기본: 아주 약한 틴트만. hover에서만 진하게 */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentWash(card.accent)} opacity-[0.22] transition-opacity duration-300 md:group-hover:opacity-[0.42] md:group-focus-within:opacity-[0.42]`}
                  aria-hidden
                />
                {/* 기본: 전면 어둡게 하지 않음 — hover 시에만 스크림 */}
                <div
                  className="pointer-events-none absolute inset-0 bg-black/0 transition-colors duration-300 ease-out md:group-hover:bg-black/[0.44] md:group-focus-within:bg-black/[0.44]"
                  aria-hidden
                />
                {/* 하단만 은은한 그라데이션(기본) → hover 시 강화 */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-black/36 via-black/10 to-transparent transition-all duration-300 ease-out md:group-hover:from-black/72 md:group-hover:via-black/38 md:group-hover:to-black/10 md:group-focus-within:from-black/72 md:group-focus-within:via-black/38 md:group-focus-within:to-black/10"
                  aria-hidden
                />

                <div className="absolute inset-0 flex flex-col justify-center p-3 sm:p-4 md:p-6 md:transition-all md:duration-300 md:ease-out md:group-hover:justify-start md:group-hover:pt-8 md:group-hover:pb-6 md:group-focus-within:justify-start md:group-focus-within:pt-8 md:group-focus-within:pb-6">
                  <div className="mx-auto w-full max-w-[19rem] text-center md:max-w-[22rem] md:transition-transform md:duration-300 md:ease-out md:group-hover:-translate-y-0.5 md:group-focus-within:-translate-y-0.5">
                    <p className="text-[1.65rem] font-bold leading-[1.08] tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.88),0_4px_20px_rgba(0,0,0,0.5),0_0_1px_rgba(0,0,0,1)] sm:text-[1.85rem] md:text-4xl md:opacity-95 md:transition-all md:duration-300 md:group-hover:opacity-100 md:group-hover:[text-shadow:0_2px_4px_rgba(0,0,0,0.92),0_6px_28px_rgba(0,0,0,0.62)] md:group-focus-within:opacity-100 md:group-focus-within:[text-shadow:0_2px_4px_rgba(0,0,0,0.92),0_6px_28px_rgba(0,0,0,0.62)] lg:text-[2.75rem] md:group-hover:scale-[1.02] md:group-focus-within:scale-[1.02]">
                      {card.categoryLabel}
                    </p>

                    <div className="mt-3 space-y-1.5 md:hidden">
                      <p className="text-[13px] font-semibold leading-snug text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.9),0_2px_12px_rgba(0,0,0,0.5)]">
                        {card.headline}
                      </p>
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
                        {card.description}
                      </p>
                      <div className="flex flex-wrap justify-center gap-1 pt-0.5">
                        {card.hints.slice(0, 3).map((h) => (
                          <span
                            key={h}
                            className="rounded-full border border-white/40 bg-black/35 px-2 py-0.5 text-[9px] font-medium text-white shadow-[0_1px_4px_rgba(0,0,0,0.45)] backdrop-blur-[2px]"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="max-md:hidden md:max-h-0 md:overflow-hidden md:opacity-0 md:transition-all md:duration-300 md:ease-out md:group-hover:mt-4 md:group-hover:max-h-[260px] md:group-hover:opacity-100 md:group-focus-within:mt-4 md:group-focus-within:max-h-[260px] md:group-focus-within:opacity-100">
                      <p className="text-xl font-semibold leading-snug tracking-tight text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.75)] md:text-2xl">
                        {card.headline}
                      </p>
                      <p className="mt-2 line-clamp-3 text-center text-[14px] leading-relaxed text-white/95 [text-shadow:0_1px_4px_rgba(0,0,0,0.7)] lg:text-[15px]">
                        {card.description}
                      </p>
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                        {card.hints.map((h) => (
                          <span
                            key={h}
                            className="rounded-full border border-white/45 bg-black/30 px-2.5 py-0.5 text-[11px] font-medium text-white shadow-[0_1px_6px_rgba(0,0,0,0.4)] backdrop-blur-[2px]"
                          >
                            {h}
                          </span>
                        ))}
                      </div>
                      <span className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-teal-100 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)] sm:text-sm">
                        {card.ctaLabel}
                        <ArrowUpRight
                          className="h-4 w-4 transition duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
