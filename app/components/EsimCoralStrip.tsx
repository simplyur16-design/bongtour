import Link from 'next/link'
import { Wifi } from 'lucide-react'
import {
  ESIM_STRIP_CTA_HREF,
  ESIM_STRIP_CTA_LABEL,
  ESIM_STRIP_SUB,
  ESIM_STRIP_TITLE,
} from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 메인 전용 eSIM 코랄 띠 — 배경 풀폭, 내부 콘텐츠는 `SITE_CONTENT_CLASS`(헤더·본문 기준선) */
export default function EsimCoralStrip() {
  return (
    <section
      aria-label="여행용 eSIM 안내"
      className="mb-3 w-full bg-gradient-to-r from-bt-coral to-bt-coral-soft py-3 text-white shadow-md ring-1 ring-white/20 sm:mb-4 sm:py-3.5 lg:mb-5 lg:py-4"
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
  )
}
