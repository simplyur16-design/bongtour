'use client'

import Link from 'next/link'
import OverseasHero from '@/app/components/travel/overseas/OverseasHero'

type Props = { inquiryHref: string }

/** 단독 허브: 해외 메인과 동일한 `OverseasHero`(단독 상품 이미지) + 문의 CTA */
export default function PrivateTripHero({ inquiryHref }: Props) {
  return (
    <div>
      <OverseasHero browseListingKind="private_trip" />
      <div className="border-b border-bt-border bg-gradient-to-b from-bt-surface to-white">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href={inquiryHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-75 hover:bg-teal-800"
            >
              단독견적 문의하기
            </Link>
            <Link
              href={`${inquiryHref}${inquiryHref.includes('?') ? '&' : '?'}topic=custom`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-75 hover:border-teal-300 hover:bg-teal-50/60 hover:text-teal-900"
            >
              맞춤여행 상담 받기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
