import Link from 'next/link'
import { Wifi } from 'lucide-react'
import {
  ESIM_STRIP_CTA_HREF,
  ESIM_STRIP_CTA_LABEL,
  ESIM_STRIP_MOBILE_SUB,
  ESIM_STRIP_MOBILE_TITLE,
  ESIM_STRIP_SUB,
  ESIM_STRIP_TITLE,
} from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 메인 전용 eSIM 코랄 띠 — 모바일: 풀폭 카드·중앙 정렬 / PC: 좌 카피 + 우 CTA 한 줄 */
export default function EsimCoralStrip() {
  return (
    <>
      <section
        aria-label="여행용 eSIM 안내"
        className="mb-4 w-full bg-gradient-to-br from-bt-coral via-bt-coral to-bt-coral-soft px-4 py-6 text-center text-white shadow-md ring-1 ring-white/20 sm:px-5 sm:py-7 lg:hidden"
      >
        <Wifi className="mx-auto h-11 w-11 opacity-95 sm:h-12 sm:w-12" strokeWidth={2.25} aria-hidden />
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-[1.65rem]">{ESIM_STRIP_MOBILE_TITLE}</h2>
        <p className="mt-2 text-sm font-medium text-white/95 sm:text-base">{ESIM_STRIP_MOBILE_SUB}</p>
        <Link
          href={ESIM_STRIP_CTA_HREF}
          className="mx-auto mt-5 flex w-full max-w-sm min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-bt-coral shadow-md transition hover:bg-white/95 active:scale-[0.99]"
        >
          <span>{ESIM_STRIP_CTA_LABEL}</span>
          <span aria-hidden className="text-lg font-bold leading-none">
            →
          </span>
        </Link>
      </section>

      <section
        aria-label="여행용 eSIM 안내"
        className="mb-3 hidden w-full bg-gradient-to-r from-bt-coral to-bt-coral-soft py-3 text-white shadow-md ring-1 ring-white/20 sm:mb-4 sm:py-3.5 lg:mb-5 lg:block lg:py-4"
      >
        <div
          className={`${SITE_CONTENT_CLASS} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:gap-5`}
        >
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center sm:gap-4">
            <Wifi className="h-7 w-7 shrink-0 opacity-95 lg:h-9 lg:w-9" strokeWidth={2.25} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-snug lg:text-base lg:font-bold">{ESIM_STRIP_TITLE}</p>
              <p className="mt-0.5 text-xs leading-snug text-white/90 lg:mt-1 lg:text-sm">{ESIM_STRIP_SUB}</p>
            </div>
          </div>
          <Link
            href={ESIM_STRIP_CTA_HREF}
            className="inline-flex w-full min-h-10 shrink-0 items-center justify-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-bt-coral shadow-sm transition hover:bg-white/95 active:scale-[0.99] sm:w-auto sm:min-h-0 sm:self-center lg:px-5 lg:py-2.5"
          >
            <span>{ESIM_STRIP_CTA_LABEL}</span>
            <span aria-hidden className="text-base font-bold leading-none">
              →
            </span>
          </Link>
        </div>
      </section>
    </>
  )
}
