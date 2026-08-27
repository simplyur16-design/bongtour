import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { bongsimCountryPickerHref, bongsimPath } from '@/lib/bongsim/constants'
import { ESIM_HERO_IMAGE_URL } from '@/lib/esim-hero-constants'
import EsimLandingHeroBackground from '@/app/travel/esim/EsimLandingHeroBackground'

const HERO_ALT = '해외 데이터, QR 한 번이면 끝 — Bong투어 eSIM'

export default function EsimLandingHero() {
  const useLocalImage = ESIM_HERO_IMAGE_URL.startsWith('/')

  return (
    <section
      className="relative w-full min-h-[480px] overflow-hidden border-b border-bt-border-soft/60 md:min-h-[600px]"
      aria-labelledby="esim-hero-heading"
    >
      {useLocalImage ? (
        <SafeImage
          src={ESIM_HERO_IMAGE_URL}
          alt={HERO_ALT}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      ) : (
        <EsimLandingHeroBackground src={ESIM_HERO_IMAGE_URL} />
      )}

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24">
        <div className="max-w-md rounded-2xl bg-white/92 px-5 py-6 shadow-[0_8px_32px_rgba(31,27,45,0.08)] backdrop-blur-sm md:max-w-lg md:px-7 md:py-8">
          <h1
            id="esim-hero-heading"
            className="text-balance text-3xl font-bold leading-tight text-[#1F1B2D] md:text-5xl"
          >
            해외 데이터,
            <br />
            <span className="text-[#D85A30]">QR 한 번</span>이면 끝
          </h1>
          <p className="mt-4 text-xl font-semibold leading-snug text-[#1F1B2D] md:text-2xl">
            초보도 OK · 요금 폭탄 없이
            <span className="text-[#D85A30]"> eSIM</span>
          </p>

          <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm md:text-base">
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
            href={bongsimCountryPickerHref()}
            // REGRESSION-FREEZE[bongsim-esim-hero-country-picker-landing]: 히어로→랜딩 피커 — manifest
            className="mt-8 inline-flex items-center justify-center rounded-full bg-[#D85A30] px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-[#C04A20] md:text-lg"
          >
            나에게 맞는 eSIM 찾기
          </Link>
        </div>
      </div>
    </section>
  )
}
