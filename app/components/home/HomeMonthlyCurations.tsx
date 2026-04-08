import MonthlyCurationSection from '@/components/bongtour/MonthlyCurationSection'
import type { MainCurationFetchResult } from '@/lib/fetch-curations-main'
import {
  MAIN_CURATION_DOMESTIC_DESC,
  MAIN_CURATION_EYEBROW,
  MAIN_CURATION_LEAD,
  MAIN_CURATION_OVERSEAS_DESC,
  MAIN_CURATION_TITLE,
} from '@/lib/main-hub-copy'

type Props = {
  yearMonth: string
  domestic: MainCurationFetchResult
  overseas: MainCurationFetchResult
}

/**
 * 메인 핵심 자산 — 월별 큐레이션. 시각적 무게 최상위.
 */
export default function HomeMonthlyCurations({ yearMonth, domestic, overseas }: Props) {
  return (
    <section
      id="monthly-curations"
      className="relative scroll-mt-24 border-t border-bt-border bg-bt-surface py-16 sm:py-20"
      aria-labelledby="home-curation-heading"
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 hidden h-px bg-gradient-to-r from-transparent via-bt-accent/25 to-transparent sm:block" aria-hidden />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-accent">{MAIN_CURATION_EYEBROW}</p>
          <h2
            id="home-curation-heading"
            className="mt-3 text-3xl font-semibold tracking-tight text-bt-ink sm:text-[2.35rem] sm:leading-[1.15]"
          >
            {MAIN_CURATION_TITLE}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bt-muted sm:text-base">{MAIN_CURATION_LEAD}</p>
        </header>

        <div className="mt-16 space-y-20 sm:mt-20 sm:space-y-24">
          <MonthlyCurationSection
            variant="domestic"
            sectionId="monthly-domestic"
            label="국내"
            description={MAIN_CURATION_DOMESTIC_DESC}
            requestedYearMonth={yearMonth}
            result={domestic}
          />
          <MonthlyCurationSection
            variant="overseas"
            sectionId="monthly-overseas"
            label="국외"
            description={MAIN_CURATION_OVERSEAS_DESC}
            requestedYearMonth={yearMonth}
            result={overseas}
          />
        </div>
      </div>
    </section>
  )
}
