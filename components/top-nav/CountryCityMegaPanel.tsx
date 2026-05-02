'use client'

import Link from 'next/link'
import type { MegaMenuCountryGroup } from '@/lib/travel-landing-mega-menu-data'
import { buildProductsHref, buildProductsHrefCountryOnly } from '@/lib/top-nav-resolve'
import type { ProductBrowseType } from '@/lib/products-browse-filter'

type Props = {
  regionId: string
  countryGroups: MegaMenuCountryGroup[]
  activeProductType: ProductBrowseType
}

/** 지리 탭: 도시가 많은 나라 블록만 2열 */
const DENSE_CITY_GRID_MIN = 6

const THEME_DENSE_REGIONS = new Set(['golf_theme', 'local_dep', 'cruise'])

function CityLinkBlock(props: {
  regionId: string
  activeProductType: ProductBrowseType
  countryLabel: string
  leaf: MegaMenuCountryGroup['cities'][number]
  /** 지리 탭 도시 링크 스타일 */
  variant: 'geo' | 'theme'
}) {
  const { regionId, activeProductType, countryLabel, leaf, variant } = props
  const isGeo = variant === 'geo'
  return (
    <li className="min-w-0 w-full max-w-full text-left">
      <Link
        href={buildProductsHref({
          type: activeProductType,
          regionId,
          countryLabel,
          leaf,
        })}
        className={
          isGeo
            ? 'block rounded-sm py-0.5 text-left text-[13px] font-normal leading-snug text-slate-700 transition hover:text-teal-600'
            : 'group block rounded-sm py-1 text-left transition hover:bg-slate-50'
        }
        title={leaf.sublabel ? `${leaf.label} — ${leaf.sublabel}` : leaf.label}
      >
        {isGeo ? (
          <span className="text-[13px] font-normal">{leaf.label}</span>
        ) : (
          <span className="text-[13px] font-medium text-slate-800 group-hover:text-teal-700">{leaf.label}</span>
        )}
        {leaf.sublabel ? (
          <span className="mt-0.5 block text-[11px] font-normal leading-snug text-slate-500">{leaf.sublabel}</span>
        ) : null}
      </Link>
    </li>
  )
}

/**
 * 여행사형 메가패널 — 지리 탭은 3~4단 그리드·타이포, 테마 탭(골프·지방출발·크루즈)은 카드형 밀도 레이아웃.
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  const isThemeDense = THEME_DENSE_REGIONS.has(regionId)

  if (isThemeDense) {
    const isCruise = regionId === 'cruise'
    const isGolf = regionId === 'golf_theme'

    return (
      <div
        className={
          isCruise
            ? 'max-h-[min(78vh,560px)] min-h-[260px] overflow-y-auto px-8 py-5'
            : 'max-h-[min(78vh,560px)] min-h-[280px] overflow-y-auto px-8 py-6'
        }
      >
        <div
          className={
            isCruise
              ? 'mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3'
              : isGolf
                ? 'mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3'
                : 'mx-auto grid w-full max-w-[1200px] grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3'
          }
        >
          {countryGroups.map((g, idx) => (
            <div
              key={`${g.countryLabel}-${idx}`}
              className="flex min-w-0 flex-col rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3.5"
            >
              {g.nonLinkHeader ? (
                <span className="mb-2.5 block border-b border-slate-200/90 pb-2 text-left text-[15px] font-bold leading-snug text-slate-900">
                  {g.countryLabel}
                </span>
              ) : (
                <Link
                  href={buildProductsHrefCountryOnly({
                    type: activeProductType,
                    regionId,
                    countryLabel: g.countryLabel,
                  })}
                  className="mb-2.5 block border-b border-slate-200/90 pb-2 text-left text-[15px] font-bold leading-snug text-slate-900 transition hover:text-teal-700"
                >
                  {g.countryLabel}
                </Link>
              )}
              <ul className="flex flex-col gap-y-0.5 text-left">
                {g.cities.map((c, ci) => (
                  <CityLinkBlock
                    key={`${g.countryLabel}-${c.label}-${ci}`}
                    regionId={regionId}
                    activeProductType={activeProductType}
                    countryLabel={g.countryLabel}
                    leaf={c}
                    variant="theme"
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    )
  }

  /* ---- 지리 탭 (일본·동남아 등) ---- */
  return (
    <div className="max-h-[min(78vh,560px)] min-h-[300px] overflow-y-auto px-8 py-7">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-2 gap-x-10 gap-y-9 sm:grid-cols-3 lg:grid-cols-4">
        {countryGroups.map((g, idx) => {
          const denseCities = g.cities.length >= DENSE_CITY_GRID_MIN
          return (
            <div
              key={`${g.countryLabel}-${idx}`}
              className="flex min-w-0 w-full max-w-[240px] flex-col items-start border-b border-transparent sm:border-b-0"
            >
              {g.nonLinkHeader ? (
                <span className="mb-2.5 block text-left text-[15px] font-bold leading-snug text-slate-900">
                  {g.countryLabel}
                </span>
              ) : (
                <Link
                  href={buildProductsHrefCountryOnly({
                    type: activeProductType,
                    regionId,
                    countryLabel: g.countryLabel,
                  })}
                  className="mb-2.5 block text-left text-[15px] font-bold leading-snug text-slate-900 transition hover:text-teal-600"
                >
                  {g.countryLabel}
                </Link>
              )}
              <ul
                className={
                  denseCities
                    ? 'grid w-full grid-cols-2 justify-items-start gap-x-3 gap-y-1 text-left'
                    : 'flex w-full flex-col items-stretch gap-y-0.5 text-left'
                }
              >
                {g.cities.map((c, ci) => (
                  <CityLinkBlock
                    key={`${g.countryLabel}-${c.label}-${ci}`}
                    regionId={regionId}
                    activeProductType={activeProductType}
                    countryLabel={g.countryLabel}
                    leaf={c}
                    variant="geo"
                  />
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
