import Image from 'next/image'
import Link from 'next/link'
import type { MonthlyCurationMidPayload } from '@/lib/overseas-cms-public'

/**
 * 해외 상품 목록에서 유럽·동남아 사이 전폭 블록으로 1회 삽입.
 */
export default function OverseasMonthlyCurationMid(props: MonthlyCurationMidPayload) {
  const { title, subtitle, excerpt, ctaLabel, href, imageUrl, imageAlt, sourceLine, monthKey } = props
  const label = ctaLabel?.trim() || '이번 달 추천 더 보기'
  const inner = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
      {imageUrl ? (
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:aspect-auto sm:h-auto sm:w-[min(42%,280px)] sm:min-h-[140px]">
          <Image
            src={imageUrl}
            alt={imageAlt || title}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width:640px) 100vw, 280px"
          />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col justify-center py-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">이번 달 추천 · {monthKey}</p>
        <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-700">{excerpt}</p>
        {sourceLine ? (
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{sourceLine}</p>
        ) : null}
        {href ? (
          <div className="mt-4">
            <span className="inline-flex text-sm font-medium text-teal-800 underline-offset-2 group-hover:underline">
              {label} →
            </span>
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500">링크는 관리자에서 연결할 수 있습니다.</p>
        )}
      </div>
    </div>
  )

  const shellClass =
    'group rounded-2xl border border-slate-200/90 bg-gradient-to-br from-slate-50/90 via-white to-teal-50/30 px-4 py-5 shadow-sm sm:px-6 sm:py-6'

  if (href) {
    return (
      <Link href={href} className={`${shellClass} block text-left transition hover:border-teal-200/80 hover:shadow-md`}>
        {inner}
      </Link>
    )
  }

  return (
    <div className={shellClass} role="region" aria-label="이번 달 추천 여행">
      {inner}
    </div>
  )
}
