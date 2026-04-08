import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import {
  MAIN_QUICK_ENTRIES,
  MAIN_QUICK_ENTRY_EYEBROW,
  MAIN_QUICK_ENTRY_LEAD,
  MAIN_QUICK_ENTRY_TITLE,
} from '@/lib/main-hub-copy'

export default function HomeQuickEntry() {
  return (
    <section
      id="quick-entry"
      className="scroll-mt-24 border-b border-bt-border bg-bt-surface py-12 sm:py-14"
      aria-labelledby="home-quick-entry-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-accent">{MAIN_QUICK_ENTRY_EYEBROW}</p>
        <h2 id="home-quick-entry-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
          {MAIN_QUICK_ENTRY_TITLE}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">{MAIN_QUICK_ENTRY_LEAD}</p>

        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MAIN_QUICK_ENTRIES.map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="group flex h-full flex-col rounded-xl border border-bt-border bg-bt-page p-4 shadow-sm transition hover:border-bt-accent/35 hover:shadow-md"
              >
                <span className="text-sm font-semibold text-bt-ink">{item.title}</span>
                <span className="mt-1 text-xs text-bt-muted">{item.blurb}</span>
                <span className="mt-2 text-[11px] text-bt-subtle">{item.hint}</span>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-bt-accent">
                  이동
                  <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
