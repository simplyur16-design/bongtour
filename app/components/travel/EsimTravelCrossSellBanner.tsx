'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Wifi } from 'lucide-react'
import {
  ESIM_STRIP_CTA_HREF,
  ESIM_STRIP_CTA_LABEL,
  ESIM_STRIP_MOBILE_SUB,
  ESIM_STRIP_MOBILE_TITLE,
} from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 여행 하위 공통 — eSIM 크로스셀 (eSIM 전용 경로에서는 숨김). */
export default function EsimTravelCrossSellBanner() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/travel/esim')) return null

  return (
    <aside
      aria-label="여행용 eSIM 안내"
      className="border-b border-bt-coral/30 bg-gradient-to-r from-bt-coral to-bt-coral-soft py-3 text-white shadow-sm"
    >
      <div className={`${SITE_CONTENT_CLASS} flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left`}>
        <div className="flex items-center gap-3">
          <Wifi className="h-8 w-8 shrink-0 opacity-95" strokeWidth={2.25} aria-hidden />
          <div>
            <p className="text-base font-bold sm:text-lg">{ESIM_STRIP_MOBILE_TITLE}</p>
            <p className="mt-0.5 text-sm text-white/90">{ESIM_STRIP_MOBILE_SUB}</p>
          </div>
        </div>
        <Link
          href={ESIM_STRIP_CTA_HREF}
          className="inline-flex min-h-10 w-full max-w-xs shrink-0 items-center justify-center gap-1 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-bt-coral shadow-sm transition hover:bg-white/95 active:scale-[0.99] sm:w-auto"
        >
          {ESIM_STRIP_CTA_LABEL}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </aside>
  )
}
