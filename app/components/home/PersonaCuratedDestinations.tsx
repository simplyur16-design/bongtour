'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  PERSONA_DESTINATIONS,
  PERSONA_DESTINATIONS_SUB,
  PERSONA_DESTINATIONS_TITLE,
  PERSONA_TABS,
  type PersonaDestinationId,
  type PersonaTabKey,
} from '@/lib/main-hub-copy'

const CARD_GRADIENT: Record<PersonaDestinationId, string> = {
  hokkaido: 'from-bt-rose-soft to-bt-brand-gold-strong',
  danang: 'from-bt-brand-gold-strong to-bt-coral',
  prague: 'from-bt-rose to-bt-bg-lavender',
  fukuoka: 'from-bt-text-muted-lavender to-bt-brand-gold-strong',
  taipei: 'from-bt-coral-soft to-bt-rose-soft',
}

export default function PersonaCuratedDestinations() {
  const [activeTab, setActiveTab] = useState<PersonaTabKey>('all')

  const visible = useMemo(
    () =>
      PERSONA_DESTINATIONS.filter((d) => {
        if (activeTab === 'all') return true
        const personas = d.personas as readonly PersonaTabKey[]
        return personas.includes(activeTab)
      }),
    [activeTab],
  )

  return (
    <section
      className="mx-auto max-w-6xl px-3 pb-6 pt-6 sm:px-5 sm:pb-8 sm:pt-8"
      aria-labelledby="persona-curated-destinations-heading"
    >
      <h2
        id="persona-curated-destinations-heading"
        className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
      >
        {PERSONA_DESTINATIONS_TITLE}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-center text-sm leading-relaxed text-bt-text-muted-lavender sm:text-[0.9375rem]">
        {PERSONA_DESTINATIONS_SUB}
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-2 sm:mt-6" role="tablist" aria-label="페르소나별 추천">
        {PERSONA_TABS.map((tab) => {
          const selected = activeTab === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.key)}
              className={
                selected
                  ? 'rounded-full bg-bt-text-navy px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95'
                  : 'rounded-full border border-bt-bg-lavender bg-white px-4 py-2 text-sm font-medium text-bt-text-navy shadow-sm transition hover:border-bt-border-strong'
              }
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <ul
        className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 lg:grid-cols-5 lg:gap-4"
        role="list"
      >
        {visible.map((d) => (
          <li key={d.id} className="min-w-0">
            <Link
              href={d.href}
              prefetch={false}
              className="group flex min-w-0 flex-col gap-1.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/70"
            >
              <span
                className={`flex h-32 w-full items-center justify-center rounded-2xl bg-gradient-to-br px-3 shadow-sm ring-1 ring-black/5 transition group-hover:ring-black/10 lg:h-44 ${CARD_GRADIENT[d.id]}`}
              >
                <span className="text-center text-lg font-medium text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">
                  {d.english}
                </span>
              </span>
              <span className="block text-center text-xs font-medium text-bt-text-muted-lavender">{d.city}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
