'use client'

import { useCallback, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { DOMESTIC_NAV_PILLARS, type DomesticPillarId } from '@/lib/domestic-landing-nav-data'

const CLOSE_DELAY = 200

export type DomesticNavApply =
  | { kind: 'region'; pillar: 'region'; secondKey: string; groupKey?: string; destinationTerms?: string[]; summaryLabel: string }
  | {
      kind: 'terms'
      pillar: 'schedule' | 'bus' | 'train' | 'ship'
      secondKey: string
      terms: string[]
      summaryLabel: string
    }
  | { kind: 'special_theme'; pillar: 'special_theme'; secondKey: string; summaryLabel: string }

type Props = {
  onApply: (a: DomesticNavApply) => void
}

export default function DomesticTravelSubMainNav({ onApply }: Props) {
  const [openPillar, setOpenPillar] = useState<DomesticPillarId | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const clearClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    clearClose()
    closeTimer.current = window.setTimeout(() => setOpenPillar(null), CLOSE_DELAY)
  }

  const handleApply = useCallback(
    (a: DomesticNavApply) => {
      onApply(a)
      setOpenPillar(null)
      setMobileOpen(false)
    },
    [onApply]
  )

  return (
    <div className="border-b border-bt-border-soft bg-white" aria-label="국내여행 탐색 메뉴">
      <div className={SITE_CONTENT_CLASS}>
        <div className="hidden lg:block">
          <div
            className="relative flex justify-start gap-1 py-1"
            onMouseLeave={scheduleClose}
          >
            {DOMESTIC_NAV_PILLARS.map((p) => {
              const open = openPillar === p.id
              return (
                <div
                  key={p.id}
                  className="relative"
                  onMouseEnter={() => {
                    clearClose()
                    setOpenPillar(p.id)
                  }}
                >
                  <button
                    type="button"
                    className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                      open ? 'bg-bt-accent-subtle text-bt-title' : 'text-bt-muted hover:bg-bt-surface-alt hover:text-bt-title'
                    }`}
                    aria-expanded={open}
                    aria-haspopup="true"
                  >
                    {p.label}
                  </button>
                  {open ? (
                    <div
                      className="absolute left-0 top-full z-[60] mt-0 min-w-[280px] rounded-b-xl border border-bt-border border-t-0 bg-white py-3 shadow-lg"
                      onMouseEnter={clearClose}
                      onMouseLeave={scheduleClose}
                    >
                      <p className="px-4 pb-2 text-[10px] leading-snug text-bt-subtle">{p.shortWhy}</p>
                      <ul className="max-h-[min(70vh,420px)] overflow-y-auto px-2">
                        {p.regionSecond?.map((item) => (
                          <li key={item.key}>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-bt-ink hover:bg-bt-surface"
                              onClick={() =>
                                handleApply({
                                  kind: 'region',
                                  pillar: 'region',
                                  secondKey: item.key,
                                  groupKey: item.groupKey,
                                  destinationTerms: item.destinationTerms,
                                  summaryLabel: item.label,
                                })
                              }
                            >
                              {item.label}
                            </button>
                          </li>
                        ))}
                        {p.termSecond?.map((item) => (
                          <li key={item.key}>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-bt-ink hover:bg-bt-surface"
                              onClick={() =>
                                handleApply({
                                  kind: 'terms',
                                  pillar: p.id as 'schedule' | 'bus' | 'train' | 'ship',
                                  secondKey: item.key,
                                  terms: item.terms,
                                  summaryLabel: item.label,
                                })
                              }
                            >
                              {item.label}
                            </button>
                          </li>
                        ))}
                        {p.specialThemeSecond?.map((item) => (
                          <li key={item.key}>
                            <button
                              type="button"
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-bt-ink hover:bg-bt-surface"
                              onClick={() =>
                                handleApply({
                                  kind: 'special_theme',
                                  pillar: 'special_theme',
                                  secondKey: item.key,
                                  summaryLabel: item.label,
                                })
                              }
                            >
                              <span className="font-medium">{item.label}</span>
                              <span className="mt-0.5 block text-[11px] font-normal text-bt-muted">{item.description}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        <div className="lg:hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 py-3 text-left text-sm font-semibold text-bt-ink"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <span>국내여행 분류 (1차 6개)</span>
            {mobileOpen ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
          </button>
          {mobileOpen ? (
            <div className="space-y-4 border-t border-bt-border/80 pb-4 pt-2">
              {DOMESTIC_NAV_PILLARS.map((p) => (
                <div key={p.id}>
                  <p className="text-xs font-semibold text-bt-ink">{p.label}</p>
                  <p className="mt-0.5 text-[10px] text-bt-subtle">{p.shortWhy}</p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {p.regionSecond?.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-bt-border/60 bg-bt-surface px-3 py-2 text-left text-sm text-bt-ink"
                          onClick={() =>
                            handleApply({
                              kind: 'region',
                              pillar: 'region',
                              secondKey: item.key,
                              groupKey: item.groupKey,
                              destinationTerms: item.destinationTerms,
                              summaryLabel: item.label,
                            })
                          }
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                    {p.termSecond?.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-bt-border/60 bg-bt-surface px-3 py-2 text-left text-sm text-bt-ink"
                          onClick={() =>
                            handleApply({
                              kind: 'terms',
                              pillar: p.id as 'schedule' | 'bus' | 'train' | 'ship',
                              secondKey: item.key,
                              terms: item.terms,
                              summaryLabel: item.label,
                            })
                          }
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                    {p.specialThemeSecond?.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          className="w-full rounded-lg border border-bt-border/60 bg-bt-surface px-3 py-2 text-left text-sm text-bt-ink"
                          onClick={() =>
                            handleApply({
                              kind: 'special_theme',
                              pillar: 'special_theme',
                              secondKey: item.key,
                              summaryLabel: item.label,
                            })
                          }
                        >
                          {item.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
