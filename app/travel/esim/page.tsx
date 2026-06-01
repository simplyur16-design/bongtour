import type { Metadata } from 'next'
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
  title: 'Bong투어 eSIM | 해외 여행 eSIM | Bong투어',
  description: '24시간 고객센터, 100% 환불 보장. 여행지에 맞는 최적의 eSIM을 찾아드립니다.',
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
