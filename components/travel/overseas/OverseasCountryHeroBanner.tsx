'use client'

import Link from 'next/link'
import CinemaHeroImage from '@/app/components/CinemaHeroImage'

export type OverseasCountryHeroBannerProps = {
  imageUrl: string | null
  title: string
  subtitle: string
  footerLine: string
  showCta: boolean
  ctaHref: string
}

/** 해외 허브 나라 선택 히어로 — `ProductsBrowseClient` 제거 전과 동일 레이아웃 */
export default function OverseasCountryHeroBanner({
  imageUrl,
  title,
  subtitle,
  footerLine,
  showCta,
  ctaHref,
}: OverseasCountryHeroBannerProps) {
  const href = (ctaHref ?? '').trim() || '/travel/overseas'
  const external = /^https?:\/\//i.test(href)
  const sub = subtitle.replace(/\s+/g, ' ').trim()
  return (
    <div className="relative h-full w-full overflow-hidden">
      {imageUrl ? (
        <CinemaHeroImage src={imageUrl} sizes="100vw" loading="eager" priority />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-teal-800 to-slate-900" aria-hidden />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" aria-hidden />
      <div className="absolute bottom-0 left-0 flex w-full flex-col p-6 text-white">
        <h2 className="line-clamp-2 text-lg font-bold leading-snug lg:text-xl">{title}</h2>
        {sub ? <p className="mt-1 line-clamp-2 text-sm text-white/80">{sub}</p> : null}
        <p className="mt-2 text-sm text-white/90">{footerLine}</p>
        {showCta ? (
          <div className="mt-3">
            {external ? (
              <a
                href={href}
                className="text-sm font-semibold text-white underline underline-offset-2 hover:text-white/90"
                rel="noopener noreferrer"
              >
                더보기
              </a>
            ) : (
              <Link href={href} className="text-sm font-semibold text-white underline underline-offset-2 hover:text-white/90">
                더보기
              </Link>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
