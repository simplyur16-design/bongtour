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

/** PC 메인 4카드 — 동일 높이, 전면 이미지 + 중앙 오버레이(하단 흰 본문칸 없음) */
const HUB_FOUR_CARD_HEIGHT = 'h-[35rem] min-h-[35rem] max-h-[35rem]'

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

/** 기본 노출용 한 줄 요약: 헤드라인 우선, 없으면 본문(길면 clamp) */
function hubCardShortLine(card: (typeof MAIN_HUB_FOUR_CARDS)[number]): string {
  const h = card.headline?.trim()
  if (h) return h
  return card.description?.trim() ?? ''
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
            const ariaBits = [card.categoryLabel, card.headline?.trim(), card.description?.trim()].filter(Boolean)
            const cardAriaLabel = ariaBits.join('. ')
            const shortLine = hubCardShortLine(card)
            const descFull = card.description?.trim() ?? ''
            const hasHeadline = Boolean(card.headline?.trim())
            /** 헤드라인이 있으면 본문은 hover에서 풀고, 없어도 본문이 길면(2줄 넘김) hover에서 전체 노출 */
            const showExpandedCopy =
              descFull.length > 0 && (hasHeadline || descFull.replace(/\s/g, '').length > 44)

            return (
              <li
                key={card.key}
                id={hubSectionFragmentId(card.key)}
                className="relative min-w-0 scroll-mt-[5.5rem] sm:scroll-mt-24"
              >
                <Link
                  href={card.href}
                  aria-label={cardAriaLabel}
                  className={`group relative flex w-full flex-col overflow-hidden border border-bt-border-soft shadow-md shadow-bt-border-soft/40 ring-1 ring-bt-border-soft transition duration-300 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/70 lg:hover:-translate-y-1 lg:hover:border-bt-border-strong lg:hover:shadow-xl lg:hover:shadow-bt-border-strong/20 lg:hover:ring-bt-border-strong/60 ${CARD_ROUND} ${HUB_FOUR_CARD_HEIGHT}`}
                >
                  <span className="pointer-events-none absolute inset-0 z-0 bg-slate-200" aria-hidden />

                  <Image
                    key={card.imageSrc}
                    src={card.imageSrc}
                    alt=""
                    fill
                    className={`object-cover transition duration-700 ease-out will-change-transform ${hubImagePosition(card.key as HomeHubCardImageKey)} z-[1] scale-100 lg:group-hover:scale-[1.04] lg:group-focus-within:scale-[1.04]`}
                    sizes="(max-width: 1024px) 50vw, min(600px, calc((min(100vw, 72rem) - 2.5rem) / 2))"
                    quality={92}
                    priority={index < 2}
                    unoptimized={/^https?:\/\//i.test(card.imageSrc)}
                  />

                  {/* 읽기용 그라데이션: 중앙·하단 가독성 */}
                  <div
                    className="pointer-events-none absolute inset-0 z-[2] bg-gradient-to-b from-slate-950/55 via-slate-950/25 to-slate-950/80"
                    aria-hidden
                  />
                  <div
                    className={`pointer-events-none absolute inset-0 z-[2] bg-gradient-to-br ${accentWash(card.accent)} opacity-25 transition-opacity duration-300 lg:group-hover:opacity-40 lg:group-focus-within:opacity-40`}
                    aria-hidden
                  />

                  <div className="relative z-[3] flex h-full flex-col items-center justify-center px-4 py-8 text-center sm:px-5">
                    <div className="flex w-full max-w-[17rem] flex-col items-center gap-2.5 sm:max-w-xs">
                      <p className="text-xl font-bold leading-tight tracking-tight text-white drop-shadow-md sm:text-2xl">
                        {card.categoryLabel}
                      </p>

                      {shortLine ? (
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-white/95 drop-shadow sm:text-[0.9375rem]">
                          {shortLine}
                        </p>
                      ) : null}

                      <div className="mt-0.5 flex max-w-full flex-wrap justify-center gap-1.5">
                        {card.hints.map((h) => (
                          <span
                            key={h}
                            className="rounded-full border border-white/35 bg-white/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/95 shadow-sm backdrop-blur-[2px] sm:text-[11px]"
                          >
                            {h}
                          </span>
                        ))}
                      </div>

                      {/* hover·키보드 포커스: 상세 본문 + CTA */}
                      <div
                        className={`mt-3 flex w-full flex-col items-center gap-3 transition duration-300 ease-out motion-reduce:transition-none ${
                          showExpandedCopy
                            ? 'max-h-0 translate-y-2 opacity-0 overflow-hidden lg:group-hover:max-h-[14rem] lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:max-h-[14rem] lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100'
                            : 'max-h-0 translate-y-1.5 opacity-0 overflow-hidden lg:group-hover:max-h-[6rem] lg:group-hover:translate-y-0 lg:group-hover:opacity-100 lg:group-focus-within:max-h-[6rem] lg:group-focus-within:translate-y-0 lg:group-focus-within:opacity-100'
                        }`}
                      >
                        {showExpandedCopy ? (
                          <p className="max-h-[9.5rem] overflow-y-auto text-left text-xs leading-relaxed text-white/92 sm:text-sm">
                            {descFull}
                          </p>
                        ) : null}
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-sm sm:text-sm">
                          {card.ctaLabel}
                          <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden />
                        </span>
                      </div>
                    </div>
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
