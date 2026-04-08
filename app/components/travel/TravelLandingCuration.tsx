import MonthlyCurationSection from '@/components/bongtour/MonthlyCurationSection'
import type { MainCurationFetchResult } from '@/lib/fetch-curations-main'
import { MAIN_CURATION_EYEBROW } from '@/lib/main-hub-copy'

type Props = {
  yearMonth: string
  scope: 'domestic' | 'overseas'
  sectionId: string
  label: string
  description: string
  result: MainCurationFetchResult
  title: string
  lead: string
}

/** 해외/국내 랜딩 상단 — 단일 scope 큐레이션 블록 */
export default function TravelLandingCuration({
  yearMonth,
  scope,
  sectionId,
  label,
  description,
  result,
  title,
  lead,
}: Props) {
  return (
    <section
      id={sectionId}
      className="scroll-mt-24 border-b border-bt-border bg-bt-surface py-12 sm:py-14"
      aria-labelledby="travel-curation-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-accent">{MAIN_CURATION_EYEBROW}</p>
          <h2 id="travel-curation-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">{lead}</p>
        </header>

        <div className="mt-10">
          <MonthlyCurationSection
            variant={scope}
            sectionId={`${sectionId}-list`}
            label={label}
            description={description}
            requestedYearMonth={yearMonth}
            result={result}
          />
        </div>
      </div>
    </section>
  )
}
