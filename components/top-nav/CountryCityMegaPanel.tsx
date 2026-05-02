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
const DENSE_CITY_GRID_MIN = 6

/**
 * 여행사형 메가패널 — 나라별 블록 구분·도시 탭/클릭 영역 강화.
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  return (
    <div className="max-h-[min(78vh,560px)] min-h-[300px] overflow-y-auto px-10 py-8">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-3 gap-x-16 gap-y-10 lg:grid-cols-4">
        {countryGroups.map((g, idx) => {
          const denseCities = g.cities.length >= DENSE_CITY_GRID_MIN
          return (
            <div key={`${g.countryLabel}-${idx}`} className="flex min-w-0 w-full max-w-[220px] flex-col items-start">
              <Link
                href={buildProductsHrefCountryOnly({
                  type: activeProductType,
                  regionId,
                  countryLabel: g.countryLabel,
                })}
                className="mb-3 block text-left text-[15px] font-bold leading-snug text-slate-800 transition hover:text-teal-600"
              >
                {g.countryLabel}
              </Link>
              <ul
                className={
                  denseCities
                    ? 'grid w-full grid-cols-2 justify-items-start gap-x-4 gap-y-1.5 text-left'
                    : 'flex w-full flex-col items-stretch space-y-1.5 text-left'
                }
              >
                {g.cities.map((c) => (
                  <li key={c.label} className="min-w-0 w-full max-w-full text-left">
                    <Link
                      href={buildProductsHref({
                        type: activeProductType,
                        regionId,
                        countryLabel: g.countryLabel,
                        leaf: c,
                      })}
                      className="block py-0.5 text-left text-[13px] text-slate-400 transition hover:text-teal-500"
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
