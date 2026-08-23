import Link from 'next/link'
import { HomeDestinationGrid } from '@/components/bongsim/HomeDestinationGrid'
import { bongsimPath } from '@/lib/bongsim/constants'
import { COUNTRY_OPTIONS } from '@/lib/bongsim/country-options'
import { HOME_POPULAR_CODES } from '@/lib/bongsim/home-data'
import { prefetchPropForHref } from '@/lib/route-prefetch-policy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import type { CountryOption } from '@/lib/bongsim/types'

const HOME_ESIM_CODES = HOME_POPULAR_CODES.filter((code) => code !== 'kr').slice(0, 12)

function homeEsimCountries(): CountryOption[] {
  const byCode = new Map(COUNTRY_OPTIONS.map((c) => [c.code, c]))
  return HOME_ESIM_CODES.map((code) => byCode.get(code)).filter(
    (c): c is CountryOption => Boolean(c),
  )
}

/** 메인 홈 — 인기 목적지 eSIM 상품 그리드 */
export default function HomeEsimProductSection() {
  const items = homeEsimCountries()
  if (items.length === 0) return null

  const catalogHref = bongsimPath('/recommend')

  return (
    <section
      aria-labelledby="home-esim-products-heading"
      className="border-b border-bt-border-soft/50 bg-white py-8 sm:py-10"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <h2
          id="home-esim-products-heading"
          className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          해외여행 eSIM
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-center text-sm leading-relaxed text-slate-600 sm:text-base">
          나라만 고르면 일수·용량에 맞는 요금제를 바로 비교할 수 있어요.
        </p>
        <div className="mt-6">
          <HomeDestinationGrid items={items} />
        </div>
        <div className="mt-6 flex justify-center">
          <Link
            href={catalogHref}
            prefetch={prefetchPropForHref(catalogHref)}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-bt-coral px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-bt-coral/90 active:scale-[0.99]"
          >
            eSIM 요금제 모두 보기
          </Link>
        </div>
      </div>
    </section>
  )
}
