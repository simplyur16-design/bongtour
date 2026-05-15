import { MAIN_HUB_FOUR_CARDS, MAIN_HUB_FOUR_SR_HEADING } from '@/lib/main-hub-copy'
import { hubFourCardKeyToHybridImageKey, resolveHomeHubCardHybridImageSrc } from '@/lib/home-hub-resolve-images'
import { getHubFourPhotosBundle } from '@/lib/home-hub-four-photo-bundle'
import { hubPhotoCardIsPending } from '@/lib/home-hub-photo-card-pending'
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

function resolveCardImageSrc(
  card: (typeof MAIN_HUB_FOUR_CARDS)[number],
  bundleUrl: string | null | undefined,
  props: HomeHubFourProps,
): string {
  const fromBundle = (bundleUrl ?? '').trim()
  if (fromBundle) return fromBundle
  return hubCardImageSrc(card, props)
}

function toClientModel(
  card: (typeof MAIN_HUB_FOUR_CARDS)[number],
  imageSrc: string,
): HomeHubFourClientCardModel {
  return {
    key: card.key,
    imageKey: hubFourCardKeyToHybridImageKey(card.key),
    href: card.href,
    categoryLabel: card.categoryLabel,
    headline: card.headline,
    titleEn: card.titleEn,
    description: card.description,
    hints: card.hints,
    ctaLabel: card.ctaLabel,
    imageSrc,
    imagePending: hubPhotoCardIsPending(imageSrc),
  }
}

export default async function HomeHubFour(props: HomeHubFourProps = {}) {
  const bundle = await getHubFourPhotosBundle()
  const cards = MAIN_HUB_FOUR_CARDS.map((card) => ({
    ...card,
    imageSrc: resolveCardImageSrc(card, bundle[card.key], props),
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
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 lg:grid-cols-4" role="list">
          {cards.map((card, index) => (
            <HomeHubFourClientCard
              key={card.key}
              card={toClientModel(card, card.imageSrc)}
              index={index}
            />
          ))}
        </ul>
      </div>
    </section>
  )
}
