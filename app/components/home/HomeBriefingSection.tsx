import { MAIN_BRIEFING } from '@/lib/main-hub-copy'

/**
 * 브리핑 예시 — 컨설팅 문서형 타임라인.
 */
export default function HomeBriefingSection() {
  return (
    <section
      id="briefing-sample"
      className="scroll-mt-24 border-t border-bt-border bg-bt-page py-14 sm:py-16"
      aria-labelledby="home-briefing-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-3xl">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bt-muted">Sample briefing</p>
          <h2 id="home-briefing-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
            {MAIN_BRIEFING.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-bt-muted">{MAIN_BRIEFING.subtitle}</p>
          <p className="mt-4 inline-flex max-w-full rounded-md border border-bt-border bg-bt-surface px-3 py-2 text-xs font-medium leading-snug text-bt-ink">
            {MAIN_BRIEFING.scenario}
          </p>
        </div>

        <div className="relative mt-12 border border-bt-border bg-bt-surface p-6 sm:p-8">
          <div className="absolute left-[1.35rem] top-8 bottom-8 hidden w-px bg-bt-border sm:block" aria-hidden />
          <ol className="space-y-8 sm:pl-10">
            {MAIN_BRIEFING.days.map((d, i) => (
              <li key={d.day} className="relative sm:pl-6">
                <span className="absolute left-0 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-bt-accent bg-bt-accent-subtle text-xs font-bold text-bt-accent sm:-left-[2.125rem]">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-bt-subtle">{d.day}</span>
                  <span className="text-sm font-semibold text-bt-ink">{d.focus}</span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-bt-muted">{d.note}</p>
              </li>
            ))}
          </ol>
        </div>

        <p className="mt-10 max-w-2xl border-l-2 border-bt-accent/40 pl-4 text-sm leading-relaxed text-bt-muted">
          {MAIN_BRIEFING.closing}
        </p>
      </div>
    </section>
  )
}
