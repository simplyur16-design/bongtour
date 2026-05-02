import type { Metadata } from 'next'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import Header from '@/app/components/Header'
import OverseasTravelSubMainNav from '@/app/components/travel/overseas/OverseasTravelSubMainNav'
import { getHomeHubCardHybridResolutionDetail } from '@/lib/home-hub-card-hybrid-core'
import { getHomeHubActiveFile } from '@/lib/home-hub-resolve-images'
import { bongsimPath } from '@/lib/bongsim/constants'

const EsimLandingBelowFold = nextDynamic(() => import('./EsimLandingBelowFold'), {
  ssr: false,
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

export default async function EsimPage() {
  /** 메인 4허브 eSIM 카드와 동일 SSOT — 관리자 `home-hub-active.json`·`/images/home-hub/esim-*.png` 반영 */
  const hubActive = getHomeHubActiveFile()
  const hubSnap = hubActive ? { images: hubActive.images, imageSourceModes: hubActive.imageSourceModes } : null
  const esimHero = getHomeHubCardHybridResolutionDetail('esim', {
    activeSnapshot: hubSnap,
    productPoolOverseasUrl: null,
    productPoolDomesticUrl: null,
  })
  const heroImageUrl = esimHero.url

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <OverseasTravelSubMainNav variant="links" />

      <section
        className="relative w-full overflow-hidden px-4 py-12 text-center lg:py-20"
        aria-labelledby="esim-hero-heading"
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- 공개 URL·로컬 `/images/` 혼합, LCP 히어로 */}
          <img src={heroImageUrl} alt="" className="h-full min-h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-sky-50/88 to-teal-50/88" />
        </div>
        <div className="relative z-10 mx-auto max-w-4xl lg:max-w-5xl">
          <h1
            id="esim-hero-heading"
            className="text-balance text-3xl font-bold leading-tight tracking-tight text-slate-900 lg:text-5xl"
          >
            여행지에 딱 맞는 eSIM
          </h1>
          <div className="mx-auto mt-3 flex max-w-2xl flex-col items-center gap-2 lg:mt-4">
            <p className="text-lg text-slate-600 lg:text-xl">해외 여행 데이터, 이제 더 쉽게</p>
            <Link
              href={bongsimPath('/devices')}
              className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
            >
              사용가능 기기 확인하기 →
            </Link>
          </div>
          <div className="mt-8 lg:mt-10">
            <Link
              href={bongsimPath('/recommend')}
              className="inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 px-10 py-4 text-lg font-bold text-white shadow-lg transition hover:from-teal-600 hover:to-cyan-600 hover:shadow-xl active:scale-[0.99]"
            >
              나에게 맞는 eSIM 찾기
            </Link>
          </div>
        </div>
      </section>

      <EsimLandingBelowFold />
    </div>
  )
}
