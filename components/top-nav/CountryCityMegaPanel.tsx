'use client'

import Link from 'next/link'
import type { MegaMenuCountryGroup } from '@/lib/travel-landing-mega-menu-data'
import { SPORTS_THEME_TAG_VALUES } from '@/lib/product-listing-kind'
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
  6: 'grid-cols-6',
}

/** 중분류=국가 leaf 1개(LC) — 헤더·하위 도시 중복 링크 방지 */
function isSingleCountryLeafGroup(g: MegaMenuCountryGroup): boolean {
  if (g.cities.length !== 1) return false
  const leaf = g.cities[0]
  if (!leaf || leaf.kind !== 'country') return false
  return leaf.label.trim() === g.countryLabel.trim()
}

/**
 * 해외 메가메뉴 공통 패널 — 전 탭 동일: 4열 그리드·타이포·호버 색.
 * REGRESSION-FREEZE[mega-menu-submenu-center-align]: 중분류 헤더·하위 도시 leaf 중앙정렬 — manifest
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  const flatGridLeafCols =
    regionId === 'south-america' ? 4 : regionId === 'sports_theme' ? SPORTS_THEME_TAG_VALUES.length : null
  const isFlatGrid = flatGridLeafCols != null
  const flatGridColsClass = flatGridLeafCols != null ? (FLAT_GRID_COLS_CLASS[flatGridLeafCols] ?? 'grid-cols-4') : ''
  const layout = resolveMegaMenuPanelLayout(regionId, countryGroups)

  if (regionId === 'sports_theme') {
    return (
      <div className="min-h-[280px] overflow-visible p-5 sm:p-6">
        <ul
          className={`m-0 mx-auto grid w-full max-w-[1200px] list-none ${flatGridColsClass} justify-items-center gap-x-8 gap-y-2 p-0 text-center`}
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
                    className="block text-center text-sm font-medium text-slate-700 transition hover:text-orange-500 leading-8"
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

  if (regionId === 'oceania') {
    return (
      <div className="flex min-h-[280px] items-start justify-center overflow-visible p-5 sm:p-6">
        <ul className="m-0 flex list-none flex-wrap items-start justify-center gap-x-12 gap-y-3 p-0 sm:gap-x-16">
          {countryGroups.map((g, idx) => {
            const leaf = g.cities[0]
            if (!leaf) return null
            const href = buildMegaMenuLeafHref({
              type: activeProductType,
              regionId,
              countryLabel: g.countryLabel,
              headerBrowseCountryLabel: g.headerBrowseCountryLabel,
              leaf,
            })
            return (
              <li key={`${regionId}-${g.countryLabel}-${idx}`} className="min-w-0">
                <Link
                  href={href}
                  prefetch={prefetchPropForHref(href)}
                  className="block whitespace-nowrap text-center text-[15px] font-bold text-slate-800 transition hover:text-orange-500"
                  title={g.countryLabel}
                >
                  {g.countryLabel}
                </Link>
              </li>
            )
          })}
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
        {countryGroups.map((g, idx) => {
          const singleCountryLeaf = isSingleCountryLeafGroup(g)
          return (
            <div
              key={`${regionId}-${g.countryLabel}-${idx}`}
              className={`${layout.compact ? 'mb-4' : 'mb-6'} min-w-0${isFlatGrid ? ' col-span-full' : ''}`}
            >
              {singleCountryLeaf ? (
                (() => {
                  const leaf = g.cities[0]!
                  const href = buildMegaMenuLeafHref({
                    type: activeProductType,
                    regionId,
                    countryLabel: g.countryLabel,
                    headerBrowseCountryLabel: g.headerBrowseCountryLabel,
                    leaf,
                  })
                  return (
                    <Link
                      href={href}
                      prefetch={prefetchPropForHref(href)}
                      className="mb-3 block text-center text-[15px] font-bold text-slate-800 transition hover:text-orange-500"
                    >
                      {g.countryLabel}
                    </Link>
                  )
                })()
              ) : (
                <>
                  {!isFlatGrid &&
                    (g.nonLinkHeader ? (
                      <span className="mb-3 block text-center text-[15px] font-bold text-slate-800">{g.countryLabel}</span>
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
                            className="mb-3 block text-center text-[15px] font-bold text-slate-800 transition hover:text-orange-500"
                          >
                            {g.countryLabel}
                          </Link>
                        )
                      })()
                    ))}
                  <ul
                    className={
                      isFlatGrid
                        ? `m-0 grid list-none ${flatGridColsClass} justify-items-center gap-x-8 gap-y-2 p-0 text-center`
                        : 'm-0 list-none p-0 text-center'
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
                            className={`block text-center text-sm text-slate-600 transition hover:text-orange-500 ${
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
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
