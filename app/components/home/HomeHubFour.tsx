import {
  MAIN_HUB_FOUR_CARDS,
  MAIN_HUB_FOUR_SECTION_SUBTITLE,
  MAIN_HUB_FOUR_SECTION_TITLE,
} from '@/lib/main-hub-copy'
import { hubFourCardKeyToHybridImageKey, resolveHomeHubCardHybridImageSrc } from '@/lib/home-hub-resolve-images'
import HomeHubFourClientCard, { type HomeHubFourClientCardModel } from '@/app/components/home/HomeHubFourClientCard'

export type HomeHubFourProps = {
  overseasHubImageSrc?: string | null
  domesticHubImageSrc?: string | null
}

function hubCardImageSrc(card: (typeof MAIN_HUB_FOUR_CARDS)[number], props: HomeHubFourProps): string {
  const hybridKey = hubFourCardKeyToHybridImageKey(card.key)
  return resolveHomeHubCardHybridImageSrc(hybridKey, {
    productPoolOverseasUrl: props.overseasHubImageSrc,
    productPoolDomesticUrl: props.domesticHubImageSrc,
  })
}

function toClientModel(
  card: (typeof MAIN_HUB_FOUR_CARDS)[number],
  imageSrc: string,
): HomeHubFourClientCardModel {
  return {
    key: card.key,
    imageKey: hubFourCardKeyToHybridImageKey(card.key),
    href: card.href,
    accent: card.accent,
    categoryLabel: card.categoryLabel,
    headline: card.headline,
    titleEn: card.titleEn,
    description: card.description,
    hints: card.hints,
    ctaLabel: card.ctaLabel,
    imageSrc,
  }
}

export default function HomeHubFour(props: HomeHubFourProps = {}) {
  const cards = MAIN_HUB_FOUR_CARDS.map((card) => ({
    ...card,
    imageSrc: hubCardImageSrc(card, props),
  }))

  return (
    <section
      id="hub-four"
      className="relative scroll-mt-20 pb-9 pt-2 sm:scroll-mt-[4.5rem] sm:pb-11 sm:pt-3 md:pb-12"
      aria-labelledby="home-hub-four-section-heading"
    >
      <div className="mx-auto max-w-6xl px-3 sm:px-5">
        <h2
          id="home-hub-four-section-heading"
          className="mb-5 text-center text-xl font-bold tracking-tight text-bt-text-navy sm:mb-6 sm:text-2xl"
        >
          {MAIN_HUB_FOUR_SECTION_TITLE}
        </h2>
        {MAIN_HUB_FOUR_SECTION_SUBTITLE ? (
          <p className="mb-5 text-center text-sm text-bt-text-muted-lavender sm:text-[0.9375rem]">
            {MAIN_HUB_FOUR_SECTION_SUBTITLE}
          </p>
        ) : null}

        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" role="list">
          {cards.map((card, index) => (
            <HomeHubFourClientCard key={card.key} card={toClientModel(card, card.imageSrc)} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
