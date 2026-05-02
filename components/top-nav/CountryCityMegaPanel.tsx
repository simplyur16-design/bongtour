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
 * 해외 메가메뉴 공통 패널 — 전 탭 동일: 4열 그리드·타이포·호버 색.
 */
export default function CountryCityMegaPanel({ regionId, countryGroups, activeProductType }: Props) {
  return (
    <div className="min-h-[280px] max-h-[min(78vh,560px)] overflow-y-auto p-6">
      <div className="mx-auto grid w-full max-w-[1200px] grid-cols-4 gap-8">
        {countryGroups.map((g, idx) => (
          <div key={`${regionId}-${g.countryLabel}-${idx}`} className="mb-6 min-w-0">
            {g.nonLinkHeader ? (
              <span className="mb-3 block text-left text-[15px] font-bold text-slate-800">{g.countryLabel}</span>
            ) : (
              <Link
                href={buildProductsHrefCountryOnly({
                  type: activeProductType,
                  regionId,
                  countryLabel: g.countryLabel,
                })}
                className="mb-3 block text-left text-[15px] font-bold text-slate-800 transition hover:text-orange-500"
              >
                {g.countryLabel}
              </Link>
            )}
            <ul className="m-0 list-none p-0 text-left">
              {g.cities.map((c, ci) => (
                <li key={`${g.countryLabel}-${c.label}-${ci}`} className="min-w-0">
                  <Link
                    href={buildProductsHref({
                      type: activeProductType,
                      regionId,
                      countryLabel: g.countryLabel,
                      leaf: c,
                    })}
                    className="block text-left text-[13px] leading-7 text-slate-600 transition hover:text-orange-500"
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
