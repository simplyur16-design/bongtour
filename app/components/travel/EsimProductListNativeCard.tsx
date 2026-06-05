import Link from 'next/link'
import { Wifi } from 'lucide-react'
import { ESIM_STRIP_CTA_HREF, ESIM_STRIP_CTA_LABEL, ESIM_STRIP_MOBILE_SUB } from '@/lib/main-hub-copy'

/** 해외 상품 목록 그리드용 — `ProductResultCard`와 동일 외곽·비율. */
export default function EsimProductListNativeCard({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href={ESIM_STRIP_CTA_HREF}
      className={
        compact
          ? 'group flex h-full flex-col overflow-hidden rounded-lg border border-bt-coral/35 bg-white shadow-sm transition hover:border-bt-coral/55 hover:shadow-md'
          : 'group flex h-full flex-col overflow-hidden rounded-xl border border-bt-coral/35 bg-white shadow-sm transition hover:border-bt-coral/55 hover:shadow-md'
      }
    >
      <div
        className={
          compact
            ? 'relative flex aspect-[4/3] w-full flex-col items-center justify-center bg-gradient-to-br from-bt-coral via-bt-coral to-bt-coral-soft px-3 text-center text-white'
            : 'relative flex aspect-[16/10] w-full flex-col items-center justify-center bg-gradient-to-br from-bt-coral via-bt-coral to-bt-coral-soft px-4 text-center text-white'
        }
      >
        <Wifi className={compact ? 'h-7 w-7 opacity-95' : 'h-10 w-10 opacity-95'} strokeWidth={2.25} aria-hidden />
        <p className={compact ? 'mt-2 text-xs font-bold tracking-tight' : 'mt-3 text-base font-bold tracking-tight'}>
          해외여행 eSIM
        </p>
        <p className={compact ? 'mt-0.5 text-[10px] font-medium text-white/90' : 'mt-1 text-xs font-medium text-white/90'}>
          {ESIM_STRIP_MOBILE_SUB}
        </p>
      </div>
      <div className={compact ? 'flex flex-1 flex-col p-2.5' : 'flex flex-1 flex-col p-4'}>
        <p className={compact ? 'text-[9px] font-medium text-bt-coral' : 'text-[11px] font-medium text-bt-coral'}>
          봉투어 eSIM
        </p>
        <h2
          className={
            compact
              ? 'mt-0.5 line-clamp-2 text-[11px] font-semibold leading-snug text-slate-900 group-hover:text-bt-coral'
              : 'mt-1 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-bt-coral'
          }
        >
          로밍 없이 데이터 걱정 끝
        </h2>
        <p className={compact ? 'mt-0.5 text-[10px] text-slate-600' : 'mt-1 text-xs text-slate-600'}>
          QR 스캔 1분 설치 · 출발 전 미리 준비
        </p>
        <div className={compact ? 'mt-auto pt-2' : 'mt-auto pt-3'}>
          <span
            className={
              compact
                ? 'inline-flex w-full items-center justify-center rounded-full bg-bt-coral px-2 py-1.5 text-[11px] font-bold text-white shadow-sm transition group-hover:bg-bt-coral/90'
                : 'inline-flex w-full items-center justify-center rounded-full bg-bt-coral px-3 py-2 text-sm font-bold text-white shadow-sm transition group-hover:bg-bt-coral/90'
            }
          >
            {ESIM_STRIP_CTA_LABEL}
          </span>
        </div>
      </div>
    </Link>
  )
}
