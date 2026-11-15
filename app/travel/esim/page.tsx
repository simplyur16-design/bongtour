import type { Metadata } from 'next'
import { buildEsimSearchMetadata, esimSearchTitle } from '@/lib/seo/esim-search-metadata'
import nextDynamic from 'next/dynamic'
import Header from '@/app/components/Header'
import EsimLandingHero from '@/app/travel/esim/EsimLandingHero'
import { SUBPAGE_PAGE_SHELL_CLASS } from '@/lib/subpage-design-system'

const EsimLandingBelowFold = nextDynamic(() => import('./EsimLandingBelowFold'), {
  loading: () => (
    <div className="mx-auto min-h-[28rem] max-w-4xl px-4 py-10 lg:max-w-5xl">
      <div className="animate-pulse rounded-xl bg-slate-100/90 py-32" aria-hidden />
    </div>
  ),
})

export const metadata: Metadata = {
  ...buildEsimSearchMetadata({
    title: esimSearchTitle('해외여행 eSIM'),
    description: '해외여행 eSIM(여행용) — 24시간 고객센터, 100% 환불 보장. 여행지에 맞는 최적의 eSIM(여행용)을 찾아드립니다.',
    path: '/travel/esim',
  }),
  // REGRESSION-FREEZE[site-title-no-double-suffix]: 문서 제목은 absolute
  title: { absolute: esimSearchTitle('해외여행 eSIM') },
}

export default function EsimPage() {
  return (
    <div className={SUBPAGE_PAGE_SHELL_CLASS}>
      <Header />
      <EsimLandingHero />
      <EsimLandingBelowFold />
    </div>
  )
}
