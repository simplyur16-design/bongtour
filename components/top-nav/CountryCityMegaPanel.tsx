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

/**
 * 여행사형 메가패널: 4열 그리드(캡처와 유사), 국가 헤더 + 구분선 + 도시 2열.
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  return (
    <div className="max-h-[min(78vh,560px)] overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8">
        {countryGroups.map((g, idx) => (
          <div key={`${g.countryLabel}-${idx}`} className="min-w-0">
            <Link
              href={buildProductsHrefCountryOnly({
                type: activeProductType,
                regionId,
                countryLabel: g.countryLabel,
              })}
              className="block text-[13px] font-bold leading-tight tracking-tight text-slate-900 hover:text-teal-700 sm:text-sm"
            >
              {g.countryLabel}
            </Link>
            <div className="mt-2 border-b border-slate-800/85" aria-hidden />
            <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[12px] sm:text-[13px]">
              {g.cities.map((c) => (
                <li key={c.label} className="min-w-0">
                  <Link
                    href={buildProductsHref({
                      type: activeProductType,
                      regionId,
                      countryLabel: g.countryLabel,
                      leaf: c,
                    })}
                    className="block truncate text-slate-700 transition hover:text-teal-700 hover:underline"
                    title={c.label}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
