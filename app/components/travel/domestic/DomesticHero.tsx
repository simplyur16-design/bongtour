import { TRAVEL_DOMESTIC_HERO } from '@/lib/main-hub-copy'
import DomesticHeroImageRotator from '@/app/components/travel/domestic/DomesticHeroImageRotator'

export default function DomesticHero() {
  const { eyebrow, title, lead } = TRAVEL_DOMESTIC_HERO
  return (
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <DomesticHeroImageRotator eyebrow={eyebrow} title={title} lead={lead} />
      </div>
    </section>
  )
}
