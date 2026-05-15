import Link from 'next/link'
import { Wifi } from 'lucide-react'
import {
  ESIM_STRIP_CTA_HREF,
  ESIM_STRIP_CTA_LABEL,
  ESIM_STRIP_SUB,
  ESIM_STRIP_TITLE,
} from '@/lib/main-hub-copy'

/** 메인 전용 eSIM 코랄 띠 — 모바일·데스크톱 동일 컴포넌트, 반응형 타이포·패딩만 변화 */
export default function EsimCoralStrip() {
  return (
    <section
      aria-label="여행용 eSIM 안내"
      className="mx-3 mb-3 rounded-xl bg-gradient-to-r from-bt-coral to-bt-coral-soft px-3 py-3 text-white shadow-md ring-1 ring-white/20 sm:mb-4 lg:mx-6 lg:mb-5 lg:rounded-2xl lg:px-6 lg:py-4"
    >
      <div className="flex flex-wrap items-center gap-3 sm:gap-4 lg:flex-nowrap lg:gap-5">
        <Wifi className="h-7 w-7 shrink-0 opacity-95 lg:h-9 lg:w-9" strokeWidth={2.25} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug lg:text-base lg:font-bold">{ESIM_STRIP_TITLE}</p>
          <p className="mt-0.5 text-xs leading-snug text-white/90 lg:mt-1 lg:text-sm">{ESIM_STRIP_SUB}</p>
        </div>
        <Link
          href={ESIM_STRIP_CTA_HREF}
          className="inline-flex w-full min-h-10 shrink-0 items-center justify-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold text-bt-coral shadow-sm transition hover:bg-white/95 active:scale-[0.99] sm:ml-auto sm:w-auto sm:min-h-0 lg:px-5 lg:py-2.5"
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
