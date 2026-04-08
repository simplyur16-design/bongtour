'use client'

import { useCallback, useId, useMemo, useRef, useState } from 'react'
import type { MegaMenuLeaf, MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'

export type RegionMegaMenuProps = {
  regions: MegaMenuRegion[]
  onLeafPick: (leaf: MegaMenuLeaf, regionId: string) => void
  onSpecial?: (action: 'free' | 'supplier' | 'curation') => void
  eyebrow?: string
  title?: string
  lead?: string
}

function scrollToProducts() {
  document.getElementById('travel-os-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function RegionMegaMenu({
  regions,
  onLeafPick,
  onSpecial,
  eyebrow = 'Explore',
  title = '지역으로 바로 가기',
  lead = '위 권역을 한 줄로 고른 뒤 마우스를 올리면, 국가별·도시별 메뉴가 넓게 펼쳐집니다.',
}: RegionMegaMenuProps) {
  const baseId = useId()
  const [openId, setOpenId] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState<string | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openRegion = useMemo(() => regions.find((r) => r.id === openId) ?? null, [regions, openId])

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpenId(null), 200)
  }, [cancelClose])

  const handleLeaf = useCallback(
    (leaf: MegaMenuLeaf, regionId: string) => {
      onLeafPick(leaf, regionId)
      setOpenId(null)
      setMobileOpen(null)
      scrollToProducts()
    },
    [onLeafPick]
  )

  const handleSpecial = useCallback(
    (r: MegaMenuRegion) => {
      if (!r.special || !onSpecial) return
      onSpecial(r.special)
      setOpenId(null)
      setMobileOpen(null)
      if (r.special !== 'curation') scrollToProducts()
    },
    [onSpecial]
  )

  return (
    <section
      id="travel-os-mega"
      className="scroll-mt-24 border-b border-bt-border bg-white px-4 py-6 sm:px-6 sm:py-7"
      aria-labelledby={`${baseId}-mega-title`}
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-muted">{eyebrow}</p>
        <h2 id={`${baseId}-mega-title`} className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-bt-muted">{lead}</p>

        {/* 데스크톱: 한 줄 탭 + 전체 너비 패널 (국가 헤더 + 도시 2열) */}
        <div className="relative mt-6 hidden lg:block">
          <div
            className="rounded-t-xl border border-b-0 border-bt-border/90 bg-bt-surface/40"
            onMouseLeave={scheduleClose}
          >
            <nav
              className="flex flex-nowrap gap-0 overflow-x-auto border-b border-bt-border/80"
              aria-label="해외 대권역 메뉴"
            >
              {regions.map((r) => {
                const active = openId === r.id
                return (
                  <button
                    key={r.id}
                    type="button"
                    onMouseEnter={() => {
                      cancelClose()
                      setOpenId(r.id)
                    }}
                    className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${
                      active
                        ? 'border-bt-accent bg-white text-bt-ink'
                        : 'border-transparent text-bt-muted hover:bg-white/80 hover:text-bt-ink'
                    }`}
                    aria-expanded={active}
                    aria-haspopup="true"
                  >
                    {r.label}
                  </button>
                )
              })}
            </nav>

            {openRegion ? (
              <div
                className="rounded-b-xl border border-t-0 border-bt-border/90 bg-white px-5 py-6 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.12)] sm:px-7"
                onMouseEnter={cancelClose}
              >
                {openRegion.special ? (
                  <div className="max-w-md">
                    {openRegion.hint ? <p className="text-sm text-bt-muted">{openRegion.hint}</p> : null}
                    <button
                      type="button"
                      onClick={() => handleSpecial(openRegion)}
                      className="mt-3 rounded-lg bg-bt-cta-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-bt-cta-primary-hover"
                    >
                      {openRegion.special === 'curation'
                        ? '추천여행 보기'
                        : openRegion.special === 'free'
                          ? '자유여행 탭으로'
                          : '공급사별 탭으로'}
                    </button>
                  </div>
                ) : openRegion.countryGroups && openRegion.countryGroups.length > 0 ? (
                  <div className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                    {openRegion.countryGroups.map((group) => (
                      <div key={`${openRegion.id}-${group.countryLabel}`} className="min-w-0">
                        <p className="border-b border-bt-border/90 pb-2 text-sm font-bold text-bt-ink">
                          {group.countryLabel}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[13px]">
                          {group.cities.map((leaf) => (
                            <button
                              key={`${group.countryLabel}-${leaf.label}`}
                              type="button"
                              onClick={() => handleLeaf(leaf, openRegion.id)}
                              className="rounded-md px-1.5 py-1 text-left text-bt-ink/90 transition hover:bg-bt-accent-subtle hover:text-bt-ink"
                            >
                              {leaf.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* 모바일: 권역 아코디언 → 국가 → 도시 칩 */}
        <div className="mt-4 space-y-2 lg:hidden">
          {regions.map((r) => {
            const expanded = mobileOpen === r.id
            return (
              <div key={r.id} className="overflow-hidden rounded-xl border border-bt-border bg-bt-surface/80">
                <button
                  type="button"
                  onClick={() => setMobileOpen((x) => (x === r.id ? null : r.id))}
                  className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-bt-ink"
                  aria-expanded={expanded}
                >
                  <span className="pr-2">{r.label}</span>
                  <span className="shrink-0 text-bt-subtle">{expanded ? '−' : '+'}</span>
                </button>
                {expanded ? (
                  <div className="border-t border-bt-border/70 bg-white px-3 pb-4 pt-2">
                    {r.special ? (
                      <>
                        {r.hint ? <p className="mb-2 text-[11px] text-bt-muted">{r.hint}</p> : null}
                        <button
                          type="button"
                          onClick={() => handleSpecial(r)}
                          className="w-full rounded-lg bg-bt-cta-primary py-2.5 text-sm font-semibold text-white"
                        >
                          {r.special === 'curation' && '추천여행으로'}
                          {r.special === 'free' && '자유여행 탭으로'}
                          {r.special === 'supplier' && '공급사별 탭으로'}
                        </button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        {r.countryGroups?.map((group) => (
                          <div key={group.countryLabel}>
                            <p className="border-b border-bt-border/80 pb-1 text-xs font-bold text-bt-ink">
                              {group.countryLabel}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {group.cities.map((leaf) => (
                                <button
                                  key={`${group.countryLabel}-${leaf.label}`}
                                  type="button"
                                  onClick={() => handleLeaf(leaf, r.id)}
                                  className="rounded-full border border-bt-border bg-bt-surface px-2.5 py-1 text-[11px] font-medium text-bt-ink"
                                >
                                  {leaf.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
