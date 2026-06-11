'use client'

import Link from 'next/link'
import type { MegaMenuCountryGroup } from '@/lib/travel-landing-mega-menu-data'
import { resolveMegaMenuPanelLayout } from '@/lib/mega-menu-panel-layout'
import { prefetchPropForHref } from '@/lib/route-prefetch-policy'
import { buildMegaMenuGroupHeaderHref, buildMegaMenuLeafHref } from '@/lib/top-nav-resolve'
import type { ProductBrowseType } from '@/lib/products-browse-filter'

type Props = {
  regionId: string
  countryGroups: MegaMenuCountryGroup[]
  activeProductType: ProductBrowseType
}

const FLAT_GRID_COLS_CLASS: Record<number, string> = {
  4: 'grid-cols-4',
  5: 'grid-cols-5',
}

/**
 * 해외 메가메뉴 공통 패널 — 전 탭 동일: 4열 그리드·타이포·호버 색.
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  const flatGridLeafCols = regionId === 'south-america' ? 4 : regionId === 'sports_theme' ? 5 : null
  const isFlatGrid = flatGridLeafCols != null
  const flatGridColsClass = flatGridLeafCols != null ? (FLAT_GRID_COLS_CLASS[flatGridLeafCols] ?? 'grid-cols-4') : ''
  const layout = resolveMegaMenuPanelLayout(regionId, countryGroups)

  if (regionId === 'sports_theme') {
    return (
      <div className="min-h-[280px] overflow-visible p-5 sm:p-6">
        <ul
          className={`m-0 mx-auto grid w-full max-w-[1200px] list-none ${flatGridColsClass} gap-x-8 gap-y-2 p-0 text-left`}
        >
          {countryGroups.flatMap((g, gi) =>
            g.cities.map((c, ci) => {
              const href = buildMegaMenuLeafHref({
                type: activeProductType,
                regionId,
                countryLabel: g.countryLabel,
                headerBrowseCountryLabel: g.headerBrowseCountryLabel,
                leaf: c,
              })
              return (
                <li key={`${g.countryLabel}-${c.label}-${gi}-${ci}`} className="min-w-0">
                  <Link
                    href={href}
                    prefetch={prefetchPropForHref(href)}
                    className="block text-left text-sm font-medium text-slate-700 transition hover:text-orange-500 leading-8"
                    title={c.label}
                  >
                    {c.label}
                  </Link>
                </li>
              )
            }),
          )}
        </ul>
      </div>
    )
  }

  return (
    <div
      className={
        layout.innerScroll
          ? 'min-h-[280px] max-h-[min(78vh,560px)] overflow-y-auto p-6'
          : 'min-h-[280px] overflow-visible p-5 sm:p-6'
      }
    >
      <div
        className={`mx-auto grid w-full ${layout.gridMaxWidthClass} ${layout.gridColsClass} ${
          layout.compact ? 'gap-x-5 gap-y-4' : 'gap-8'
        }`}
      >
        {countryGroups.map((g, idx) => (
          <div
            key={`${regionId}-${g.countryLabel}-${idx}`}
            className={`${layout.compact ? 'mb-4' : 'mb-6'} min-w-0${isFlatGrid ? ' col-span-full' : ''}`}
          >
            {!isFlatGrid &&
              (g.nonLinkHeader ? (
                <span className="mb-3 block text-left text-[15px] font-bold text-slate-800">{g.countryLabel}</span>
              ) : (
                (() => {
                  const href = buildMegaMenuGroupHeaderHref({
                    type: activeProductType,
                    regionId,
                    countryLabel: g.countryLabel,
                    headerBrowseCountryLabel: g.headerBrowseCountryLabel,
                  })
                  return (
                    <Link
                      href={href}
                      prefetch={prefetchPropForHref(href)}
                      className="mb-3 block text-left text-[15px] font-bold text-slate-800 transition hover:text-orange-500"
                    >
                      {g.countryLabel}
                    </Link>
                  )
                })()
              ))}
            <ul
              className={
                isFlatGrid
                  ? `m-0 grid list-none ${flatGridColsClass} gap-x-8 gap-y-2 p-0 text-left`
                  : 'm-0 list-none p-0 text-left'
              }
            >
              {g.cities.map((c, ci) => {
                const href = buildMegaMenuLeafHref({
                  type: activeProductType,
                  regionId,
                  countryLabel: g.countryLabel,
                  headerBrowseCountryLabel: g.headerBrowseCountryLabel,
                  leaf: c,
                })
                return (
                  <li key={`${g.countryLabel}-${c.label}-${ci}`} className="min-w-0">
                    <Link
                      href={href}
                      prefetch={prefetchPropForHref(href)}
                      className={`block text-left text-sm text-slate-600 transition hover:text-orange-500 ${
                        layout.compact ? 'leading-7' : 'leading-8'
                      }`}
                      title={c.label}
                    >
                      {c.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
