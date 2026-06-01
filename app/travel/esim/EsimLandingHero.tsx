'use client'

import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { bongsimPath } from '@/lib/bongsim/constants'
import { ESIM_HERO_IMAGE_URL } from '@/lib/esim-hero-constants'

export default function EsimLandingHero() {
  return (
    <section
      className="relative w-full min-h-[480px] overflow-hidden border-b border-bt-border-soft/60 md:min-h-[600px]"
      aria-labelledby="esim-hero-heading"
    >
      <SafeImage
        src={ESIM_HERO_IMAGE_URL}
        alt="여행지에 딱 맞는 eSIM — 전세계 어디서나 연결"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24">
        <div className="max-w-md md:max-w-lg">
          <h1
            id="esim-hero-heading"
            className="text-balance text-3xl font-bold leading-tight text-[#1F1B2D] md:text-5xl"
          >
            여행지에 딱 맞는
            <br />
            <span className="text-[#D85A30]">eSIM</span>
          </h1>
          <p className="mt-4 text-lg font-medium text-[#1F1B2D] md:text-xl">
            해외 여행 데이터,{' '}
            <span className="font-semibold text-[#D85A30]">이제 더 쉽게</span>
          </p>

          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link
              href={bongsimPath('/devices')}
              className="font-medium text-[#1F1B2D] underline underline-offset-4 transition-opacity hover:opacity-80"
            >
              사용가능 기기 확인하기 →
            </Link>
            <Link
              href={bongsimPath('/guide')}
              className="font-medium text-[#1F1B2D] underline underline-offset-4 transition-opacity hover:opacity-80"
            >
              설치 가이드 보기 →
            </Link>
          </div>

          <Link
            href={bongsimPath('/recommend')}
            className="mt-8 inline-flex items-center justify-center rounded-full bg-[#D85A30] px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-[#C04A20] md:text-lg"
          >
            나에게 맞는 eSIM 찾기
          </Link>
        </div>
      </div>
    </section>
  )
}
