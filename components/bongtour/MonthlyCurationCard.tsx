import BongtourCtaButton from '@/components/bongtour/BongtourCtaButton'
import type { PublicCurationCard } from '@/lib/monthly-curation'
import {
  buildCurationInquiryHref,
  curationPrimaryTypeToCtaVariant,
} from '@/lib/monthly-curation'

type Props = {
  item: PublicCurationCard
  curationScope: 'domestic' | 'overseas'
}

/**
 * 추천 브리핑 카드 — 상품 타일이 아닌 에디토리얼 카드 톤.
 */
export default function MonthlyCurationCard({ item, curationScope }: Props) {
  const href = buildCurationInquiryHref(item)
  const variant = curationPrimaryTypeToCtaVariant(item.primaryInquiryType)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-bt-border bg-bt-card shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition hover:border-bt-border-strong hover:shadow-md">
      <div className="border-b border-bt-border/80 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-bt-subtle">{item.yearMonth}</span>
          <span
            className="max-w-[58%] rounded border border-bt-border bg-bt-badge px-2 py-0.5 text-right text-[10px] font-medium text-bt-badge-ink"
            title={item.briefingSourceLabel}
          >
            {item.briefingSourceLabel}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold tracking-tight text-bt-ink sm:text-[1.35rem]">
          {item.destinationName}
        </h3>
        <p className="mt-2 text-sm font-medium leading-snug text-bt-accent">{item.oneLineTheme}</p>
        {curationScope === 'overseas' && (
          <p className="mt-2 text-[10px] font-medium text-bt-muted">패키지 · 자유 · 에어텔 — 상담 시 성격 구분</p>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-bt-subtle">Why now</p>
          <p className="mt-1.5 text-sm leading-relaxed text-bt-muted">{item.whyNowText}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-bt-subtle">For whom</p>
          <p className="mt-1.5 text-sm leading-relaxed text-bt-muted">{item.recommendedForText}</p>
        </div>
      </div>

      <div className="border-t border-bt-border/70 bg-bt-page px-5 py-3 sm:px-6">
        <p className="text-[11px] leading-snug text-bt-muted">
          <span className="font-semibold text-bt-ink">상담 시점</span>
          <span className="text-bt-subtle"> · </span>
          {item.leadTimeLabel}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-bt-border/70 px-5 py-5 sm:px-6">
        <BongtourCtaButton variant={variant} href={href} size="md" className="w-full justify-center sm:w-auto" />
        <p className="text-center text-[10px] leading-snug text-bt-subtle sm:text-left">이 카드로 문의 시 맥락이 함께 전달됩니다.</p>
      </div>
    </article>
  )
}
