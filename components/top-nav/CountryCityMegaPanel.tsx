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

/** 도시가 많은 나라 블록은 2열로 읽기 쉽게 */
const DENSE_CITY_GRID_MIN = 5

/**
 * 여행사형 메가패널 — 나라별 블록 구분·도시 탭/클릭 영역 강화.
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  return (
    <div className="max-h-[min(78vh,560px)] min-h-[300px] overflow-y-auto p-6">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-3 gap-x-8 gap-y-6 lg:grid-cols-4">
        {countryGroups.map((g, idx) => {
          const denseCities = g.cities.length >= DENSE_CITY_GRID_MIN
          return (
            <div key={`${g.countryLabel}-${idx}`} className="min-w-0">
              <Link
                href={buildProductsHrefCountryOnly({
                  type: activeProductType,
                  regionId,
                  countryLabel: g.countryLabel,
                })}
                className="mb-2 block border-b border-slate-200 pb-1 text-base font-bold leading-snug tracking-tight text-slate-900 transition hover:text-teal-700"
              >
                {g.countryLabel}
              </Link>
              <ul
                className={
                  denseCities
                    ? 'grid grid-cols-2 gap-x-4 gap-y-1.5'
                    : 'flex flex-col space-y-1.5'
                }
              >
                {g.cities.map((c) => (
                  <li key={c.label} className="min-w-0">
                    <Link
                      href={buildProductsHref({
                        type: activeProductType,
                        regionId,
                        countryLabel: g.countryLabel,
                        leaf: c,
                      })}
                      className="block truncate py-0.5 text-sm text-slate-600 transition hover:text-teal-600"
                      title={c.label}
                    >
                      {c.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
