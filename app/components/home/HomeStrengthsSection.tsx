import { Bus, Building2, Languages, Sparkles } from 'lucide-react'
import { MAIN_STRENGTHS, MAIN_STRENGTHS_SECTION_LEAD, MAIN_STRENGTHS_SECTION_TITLE } from '@/lib/main-hub-copy'

const ICONS = {
  curation: Sparkles,
  institution: Building2,
  interpretation: Languages,
  bus: Bus,
} as const

/**
 * 핵심 역량 4카드.
 */
export default function HomeStrengthsSection() {
  return (
    <section className="border-t border-bt-border bg-bt-surface py-14 sm:py-16" aria-labelledby="home-strengths-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bt-muted">Capabilities</p>
        <h2 id="home-strengths-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
          {MAIN_STRENGTHS_SECTION_TITLE}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">{MAIN_STRENGTHS_SECTION_LEAD}</p>

        <ul className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
          {MAIN_STRENGTHS.map((s, idx) => {
            const Icon = ICONS[s.key as keyof typeof ICONS]
            return (
              <li
                key={s.key}
                className="relative flex gap-5 overflow-hidden rounded-2xl border border-bt-border bg-bt-page p-6"
              >
                <span
                  className="pointer-events-none absolute right-3 top-2 font-mono text-4xl font-semibold tabular-nums text-bt-border"
                  aria-hidden
                >
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-bt-accent-subtle text-bt-accent">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="relative min-w-0">
                  <h3 className="text-base font-semibold text-bt-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-bt-muted">{s.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
