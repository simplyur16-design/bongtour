import { DISCLOSURE_SECTIONS, SUPPLIER_RELATION_COPY } from '@/lib/bongtour-copy'

export type BongtourDisclosureBlockProps = {
  compact?: boolean
  showSupplierNotice?: boolean
  showBookingNotice?: boolean
  className?: string
  /** 공급사 로고·브랜드 표기 보조 문구까지 함께 표시 */
  showBrandMarkHelper?: boolean
}

/**
 * 공통 고지: 공급사 관계·접수/상담 단계 안내.
 * compact 시 짧은 문장만 사용.
 */
export default function BongtourDisclosureBlock({
  compact = false,
  showSupplierNotice = true,
  showBookingNotice = true,
  className = '',
  showBrandMarkHelper = false,
}: BongtourDisclosureBlockProps) {
  const wrap = `rounded-xl border border-slate-200/90 bg-base-muted/80 text-slate-700 shadow-sm ${className}`.trim()

  if (!showSupplierNotice && !showBookingNotice && !showBrandMarkHelper) {
    return null
  }

  return (
    <aside className={wrap} role="note" aria-label="서비스 안내">
      <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
        {showSupplierNotice && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {DISCLOSURE_SECTIONS.supplierRelation.heading}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              {compact
                ? DISCLOSURE_SECTIONS.supplierRelation.textCompact
                : DISCLOSURE_SECTIONS.supplierRelation.text}
            </p>
            {showBrandMarkHelper && (
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {SUPPLIER_RELATION_COPY.brandMarkHelper}
              </p>
            )}
          </section>
        )}

        {showBookingNotice && (
          <section className={showSupplierNotice ? 'border-t border-slate-200/90 pt-4' : ''}>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {DISCLOSURE_SECTIONS.bookingClarity.heading}
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
              {compact
                ? DISCLOSURE_SECTIONS.bookingClarity.textCompact
                : DISCLOSURE_SECTIONS.bookingClarity.text}
            </p>
          </section>
        )}

        {!showSupplierNotice && showBrandMarkHelper && (
          <p className="text-xs leading-relaxed text-slate-500">{SUPPLIER_RELATION_COPY.brandMarkHelper}</p>
        )}
      </div>
    </aside>
  )
}
