import { TRAVEL_DOMESTIC_HERO } from '@/lib/main-hub-copy'
import DomesticHeroImageRotator from '@/app/components/travel/domestic/DomesticHeroImageRotator'

export default function DomesticHero() {
  return (
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <p className="bt-section-kicker text-bt-accent">
          {TRAVEL_DOMESTIC_HERO.eyebrow}
        </p>
        <h1 className="bt-wrap mt-3 text-3xl font-black tracking-tight text-bt-title sm:text-4xl">
          {TRAVEL_DOMESTIC_HERO.title}
        </h1>
        <p className="bt-wrap mt-5 max-w-2xl text-sm leading-relaxed text-bt-muted sm:text-base">{TRAVEL_DOMESTIC_HERO.lead}</p>
        <DomesticHeroImageRotator />
      </div>
    </section>
  )
}
