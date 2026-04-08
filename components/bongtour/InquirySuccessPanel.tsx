import {
  INQUIRY_SUCCESS_BY_TYPE,
  INQUIRY_SUCCESS_DEFAULT,
  SHORT_NOTICES,
  type InquirySuccessKind,
} from '@/lib/bongtour-copy'

export type InquirySuccessPanelProps = {
  type?: InquirySuccessKind
  className?: string
  /** 하단 짧은 안내(기본: successFooter 카피) */
  showFooterNotice?: boolean
}

/**
 * 문의 완료 화면용 패널. (P1) 표시만 — 제출 로직 없음.
 */
export default function InquirySuccessPanel({
  type,
  className = '',
  showFooterNotice = true,
}: InquirySuccessPanelProps) {
  const content = type ? INQUIRY_SUCCESS_BY_TYPE[type] : INQUIRY_SUCCESS_DEFAULT

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-white px-5 py-8 text-center shadow-sm sm:px-8 ${className}`.trim()}
    >
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-800"
        aria-hidden
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="mt-5 text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
        {content.headline}
      </h2>
      <ul className="mx-auto mt-4 max-w-md space-y-2 text-left text-sm leading-relaxed text-slate-600">
        {content.lines.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-600/70" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      {showFooterNotice && (
        <p className="mx-auto mt-6 max-w-md border-t border-slate-100 pt-5 text-xs leading-relaxed text-slate-500">
          {SHORT_NOTICES.successFooter}
        </p>
      )}
    </div>
  )
}
