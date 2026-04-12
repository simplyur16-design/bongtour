import { TRAVEL_DOMESTIC_HERO } from '@/lib/main-hub-copy'
import DomesticHeroImageRotator from '@/app/components/travel/domestic/DomesticHeroImageRotator'

export default function DomesticHero() {
  return (
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl space-y-5">
        <DomesticHeroImageRotator />
        <div className="rounded-2xl border border-bt-border-soft bg-bt-surface px-5 py-4 shadow-sm sm:px-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-800/90 sm:text-xs">
            {TRAVEL_DOMESTIC_HERO.eyebrow}
          </p>
          <h1 className="bt-wrap mt-2 text-2xl font-black leading-[1.15] tracking-tight text-bt-title sm:mt-3 sm:text-3xl md:text-4xl">
            {TRAVEL_DOMESTIC_HERO.title}
          </h1>
          <p className="bt-wrap mt-3 max-w-2xl text-sm leading-relaxed text-bt-body sm:mt-4 sm:text-base">
            {TRAVEL_DOMESTIC_HERO.lead}
          </p>
        </div>
      </div>
    </section>
  )
}
