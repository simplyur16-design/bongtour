import Link from 'next/link'
import { Wifi } from 'lucide-react'
import { ESIM_STRIP_CTA_HREF, ESIM_STRIP_CTA_LABEL, ESIM_STRIP_MOBILE_SUB } from '@/lib/main-hub-copy'

/** 해외 상품 목록 그리드용 — `ProductResultCard`와 동일 외곽·비율. */
export default function EsimProductListNativeCard() {
  return (
    <Link
      href={ESIM_STRIP_CTA_HREF}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-bt-coral/35 bg-white shadow-sm transition hover:border-bt-coral/55 hover:shadow-md"
    >
      <div className="relative flex aspect-[16/10] w-full flex-col items-center justify-center bg-gradient-to-br from-bt-coral via-bt-coral to-bt-coral-soft px-4 text-center text-white">
        <Wifi className="h-10 w-10 opacity-95" strokeWidth={2.25} aria-hidden />
        <p className="mt-3 text-base font-bold tracking-tight">해외여행 eSIM</p>
        <p className="mt-1 text-xs font-medium text-white/90">{ESIM_STRIP_MOBILE_SUB}</p>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[11px] font-medium text-bt-coral">봉투어 eSIM</p>
        <h2 className="mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-bt-coral">
          로밍 없이 데이터 걱정 끝
        </h2>
        <p className="mt-1 text-xs text-slate-600">QR 스캔 1분 설치 · 출발 전 미리 준비</p>
        <div className="mt-auto pt-3">
          <span className="inline-flex w-full items-center justify-center rounded-full bg-bt-coral px-3 py-2 text-sm font-bold text-white shadow-sm transition group-hover:bg-bt-coral/90">
            {ESIM_STRIP_CTA_LABEL}
          </span>
        </div>
      </div>
    </Link>
  )
}
