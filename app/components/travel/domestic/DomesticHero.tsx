import { TRAVEL_DOMESTIC_HERO } from '@/lib/main-hub-copy'
import DomesticHeroImageRotator from '@/app/components/travel/domestic/DomesticHeroImageRotator'

export default function DomesticHero() {
  return (
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        <DomesticHeroImageRotator>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-200/95 drop-shadow-[0_1px_8px_rgba(0,0,0,0.75)] sm:text-xs">
            {TRAVEL_DOMESTIC_HERO.eyebrow}
          </p>
          <h1 className="bt-wrap mt-2 text-2xl font-black leading-[1.15] tracking-tight text-white drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] sm:mt-3 sm:text-3xl md:text-4xl">
            {TRAVEL_DOMESTIC_HERO.title}
          </h1>
          <p className="bt-wrap mt-3 max-w-md text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_10px_rgba(0,0,0,0.75)] sm:mt-4 sm:text-base">
            {TRAVEL_DOMESTIC_HERO.lead}
          </p>
        </DomesticHeroImageRotator>
      </div>
    </section>
  )
}
