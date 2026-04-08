import type { OverseasEditorialBriefingPayload } from '@/lib/overseas-editorial-prioritize'

/**
 * 해외 목록 유럽 버킷 안에서만 사용. 바깥 `space-y`/섹션 간격에 맡기기 위해 블록 자체에는 세로 margin 없음.
 */
export default function OverseasDestinationBriefingMid({ title, subtitle, excerpt }: OverseasEditorialBriefingPayload) {
  return (
    <div
      className="rounded-xl border border-dashed border-teal-200/90 bg-gradient-to-br from-teal-50/50 to-slate-50/80 px-4 py-5 sm:px-6"
      role="region"
      aria-label="목적지 브리핑"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-800/80">목적지 브리핑</p>
      <h3 className="mt-2 text-base font-semibold leading-snug text-slate-900 sm:text-lg">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-600">{subtitle}</p> : null}
      <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-700">{excerpt}</p>
    </div>
  )
}
