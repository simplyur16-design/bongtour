import Link from 'next/link'
import { Wifi } from 'lucide-react'
import { ESIM_STRIP_CTA_HREF, ESIM_STRIP_CTA_LABEL, ESIM_STRIP_MOBILE_SUB } from '@/lib/main-hub-copy'

/** 해외 상품 상세 하단 — 상담 CTA 근처 eSIM 크로스셀. */
export default function EsimProductDetailCrossSell() {
  return (
    <section
      className="rounded-2xl border border-bt-coral/30 bg-gradient-to-br from-bt-coral/8 via-white to-white p-5 sm:p-6"
      aria-labelledby="esim-detail-cross-sell-heading"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bt-coral text-white">
            <Wifi className="h-6 w-6" strokeWidth={2.25} aria-hidden />
          </div>
          <div>
            <h2 id="esim-detail-cross-sell-heading" className="text-base font-bold text-slate-900">
              이 여행에 eSIM이 필요하세요?
            </h2>
            <p className="mt-1 text-sm text-slate-600">{ESIM_STRIP_MOBILE_SUB}</p>
            <p className="mt-0.5 text-xs text-slate-500">QR 스캔 1분 설치 · 출발 전 미리 준비</p>
          </div>
        </div>
        <Link
          href={ESIM_STRIP_CTA_HREF}
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-bt-coral px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-bt-coral/90"
        >
          {ESIM_STRIP_CTA_LABEL}
        </Link>
      </div>
    </section>
  )
}
