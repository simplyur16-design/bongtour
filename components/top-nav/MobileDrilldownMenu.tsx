'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProductBrowseType } from '@/lib/products-browse-filter'
import { TOP_NAV_MEGA_REGIONS } from '@/lib/top-nav-resolve'
import { buildProductsHref, buildProductsHrefCountryOnly } from '@/lib/top-nav-resolve'
import { OVERSEAS_SUB_NAV_ITEMS } from '@/components/top-nav/overseas-sub-nav-items'
import BudgetFinderButton from '@/components/top-nav/BudgetFinderButton'
import BudgetFinderPanel from '@/components/top-nav/BudgetFinderPanel'
import PrivateQuoteButton from '@/components/top-nav/PrivateQuoteButton'
type Step = 'types' | 'regions' | 'countries' | 'cities'

type Props = {
  /** 해외 서브메인 등에 넣을 때 상단 border·패딩 중복 제거 */
  embedded?: boolean
}

export default function MobileDrilldownMenu({ embedded = false }: Props) {
  const [productType, setProductType] = useState<ProductBrowseType>('travel')
  const [regionId, setRegionId] = useState<string | null>(null)
  const [countryLabel, setCountryLabel] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('types')
  const [budgetOpen, setBudgetOpen] = useState(false)
  const budgetRef = useRef<HTMLDivElement>(null)

  const region = regionId ? TOP_NAV_MEGA_REGIONS.find((r) => r.id === regionId) : null

  const reset = () => {
    setStep('types')
    setRegionId(null)
    setCountryLabel(null)
  }

  return (
    <div
      className={
        embedded
          ? 'bg-white px-0 py-1'
          : 'border-t border-slate-200 bg-white px-4 py-3'
      }
    >
      <div className="mb-3 flex gap-2">
        <div ref={budgetRef} className="relative flex-1">
          <BudgetFinderButton open={budgetOpen} onClick={() => setBudgetOpen((o) => !o)} />
          <div className="relative">
            <BudgetFinderPanel open={budgetOpen} onClose={() => setBudgetOpen(false)} anchorRef={budgetRef} />
          </div>
        </div>
        <PrivateQuoteButton />
      </div>

      {step === 'types' && (
        <ul className="space-y-0">
          {OVERSEAS_SUB_NAV_ITEMS.map((t) =>
            t.kind === 'link' ? (
              <li key={t.href} className="border-b border-slate-100">
                <Link
                  href={t.href}
                  className="flex w-full items-center justify-between py-3 text-left text-base font-medium text-slate-900"
                  onClick={reset}
                >
                  {t.label}
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </Link>
              </li>
            ) : (
              <li key={t.label} className="border-b border-slate-100">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-3 text-left text-base font-medium text-slate-900"
                  onClick={() => {
                    setProductType(t.browseType)
                    setStep('regions')
                  }}
                >
                  {t.label}
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </button>
              </li>
            )
          )}
        </ul>
      )}

      {step === 'regions' && (
        <div>
          <button
            type="button"
            className="mb-2 flex items-center gap-1 text-sm font-medium text-sky-800"
            onClick={() => setStep('types')}
          >
            <ChevronLeft className="h-4 w-4" />
            상품 유형
          </button>
          <div className="text-xs text-slate-500">
            선택:{' '}
            {OVERSEAS_SUB_NAV_ITEMS.find((x) => x.kind === 'mega' && x.browseType === productType)?.label ??
              '여행상품'}
          </div>
          <ul className="mt-2 space-y-0">
            {TOP_NAV_MEGA_REGIONS.map((r) => (
              <li key={r.id} className="border-b border-slate-100">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-3 text-left text-[15px] font-medium text-slate-900"
                  onClick={() => {
                    setRegionId(r.id)
                    setStep('countries')
                  }}
                >
                  {r.label}
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'countries' && region?.countryGroups && (
        <div>
          <button
            type="button"
            className="mb-2 flex items-center gap-1 text-sm font-medium text-sky-800"
            onClick={() => setStep('regions')}
          >
            <ChevronLeft className="h-4 w-4" />
            권역
          </button>
          <ul className="space-y-0">
            {region.countryGroups.map((g) => (
              <li key={g.countryLabel} className="border-b border-slate-100">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-3 text-left text-[15px] font-semibold text-slate-900"
                  onClick={() => {
                    setCountryLabel(g.countryLabel)
                    setStep('cities')
                  }}
                >
                  {g.countryLabel}
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === 'cities' && region?.countryGroups && countryLabel && (
        <div>
          <button
            type="button"
            className="mb-2 flex items-center gap-1 text-sm font-medium text-sky-800"
            onClick={() => setStep('countries')}
          >
            <ChevronLeft className="h-4 w-4" />
            국가
          </button>
          <Link
            href={buildProductsHrefCountryOnly({
              type: productType,
              regionId: region.id,
              countryLabel,
            })}
            className="mb-3 block text-sm font-semibold text-teal-700 underline"
            onClick={reset}
          >
            {countryLabel} 전체 상품 보기
          </Link>
          <ul className="space-y-1">
            {region.countryGroups
              .find((g) => g.countryLabel === countryLabel)
              ?.cities.map((c) => (
                <li key={c.label}>
                  <Link
                    href={buildProductsHref({
                      type: productType,
                      regionId: region.id,
                      countryLabel,
                      leaf: c,
                    })}
                    className="block rounded-lg px-2 py-2 text-[15px] text-slate-800 hover:bg-slate-50"
                    onClick={reset}
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}
