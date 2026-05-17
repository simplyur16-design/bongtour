import Link from 'next/link'
import { Wifi } from 'lucide-react'
import { ESIM_STRIP_CTA_HREF } from '@/lib/main-hub-copy'

type EsimProductDetailCrossSellProps = {
  /** 있으면 추천 퍼널로 destination 쿼리 전달 */
  primaryDestination?: string | null
  className?: string
}

/** 해외 상품·일정 상세 — eSIM 크로스셀 배너 (단일 SSOT) */
export default function EsimProductDetailCrossSell({
  primaryDestination,
  className = '',
}: EsimProductDetailCrossSellProps) {
  const dest = (primaryDestination ?? '').trim()
  const href = dest
    ? `/travel/esim/recommend?destination=${encodeURIComponent(dest)}`
    : ESIM_STRIP_CTA_HREF

  return (
    <aside
      className={`flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 sm:gap-4 sm:p-4 ${className}`.trim()}
      aria-label="eSIM 안내"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#D85A30]">
        <Wifi className="h-6 w-6 text-white" strokeWidth={2.25} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-bold fit-tx-primary">이 여행에 eSIM이 필요하세요?</p>
        <p className="mt-0.5 text-sm text-gray-600">로밍보다 90% 저렴 · 1분 설치</p>
        <p className="mt-0.5 hidden text-xs text-gray-500 sm:block">QR 스캔 1분 설치 · 출발 전 미리 준비</p>
      </div>
      <Link
        href={href}
        className="shrink-0 rounded-full bg-[#D85A30] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#C24E2A] sm:px-6 sm:py-3"
      >
        eSIM 찾기
      </Link>
    </aside>
  )
}
