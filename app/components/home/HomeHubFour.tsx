import { MAIN_HUB_FOUR_CARDS, MAIN_HUB_FOUR_SR_HEADING } from '@/lib/main-hub-copy'
import { resolveHomeHubCardHybridImageSrc } from '@/lib/home-hub-resolve-images'
import type { HomeHubCardImageKey } from '@/lib/home-hub-images'
import HomeHubFourClientCard, { type HomeHubFourClientCardModel } from '@/app/components/home/HomeHubFourClientCard'

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

function toClientModel(
  card: (typeof MAIN_HUB_FOUR_CARDS)[number],
  imageSrc: string,
): HomeHubFourClientCardModel {
  return {
    key: card.key as HomeHubCardImageKey,
    href: card.href,
    accent: card.accent,
    categoryLabel: card.categoryLabel,
    headline: card.headline,
    description: card.description,
    hints: card.hints,
    ctaLabel: card.ctaLabel,
    imageSrc,
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
          {cards.map((card, index) => (
            <HomeHubFourClientCard key={card.key} card={toClientModel(card, card.imageSrc)} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
