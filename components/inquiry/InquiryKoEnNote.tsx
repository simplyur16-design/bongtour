/**
 * REGRESSION-FREEZE[inquiry-lang-en-korean-first]: 한글 본문 다음 줄에만 영문 — manifest
 * REGRESSION-FREEZE[inquiry-lang-en-field-phone]: 필드명 한글 옆 영문 — manifest
 */
export function InquiryKoEnBeside({ ko, en }: { ko: string; en?: string | null }) {
  return (
    <>
      {ko}
      {en ? <span className="ml-1.5 font-normal text-slate-500">{en}</span> : null}
    </>
  )
}

export default function InquiryKoEnNote({
  ko,
  en,
  koClassName = 'text-sm leading-relaxed text-slate-600',
  enClassName = 'mt-1 text-xs leading-relaxed text-slate-500',
}: {
  ko: string
  en?: string | null
  koClassName?: string
  enClassName?: string
}) {
  return (
    <>
      <p className={koClassName}>{ko}</p>
      {en ? <p className={enClassName}>{en}</p> : null}
    </>
  )
}
