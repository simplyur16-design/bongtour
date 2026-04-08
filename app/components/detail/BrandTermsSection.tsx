import type { BrandTerms } from '@/lib/terms'

type Props = {
  brandName: string
  terms: BrandTerms
}

/**
 * 상세페이지 하단: 해당 브랜드 기본 약관 + 취소/환불 수수료 규정.
 */
export default function BrandTermsSection({ brandName, terms }: Props) {
  const hasAny = terms.defaultTerms || terms.cancelFeeTerms
  if (!hasAny) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900">
        {brandName} 이용·취소 규정
      </h2>
      {terms.defaultTerms && (
        <div className="mt-3">
          <h3 className="text-sm font-semibold text-gray-800">기본 약관</h3>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {terms.defaultTerms}
          </div>
        </div>
      )}
      {terms.cancelFeeTerms && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-gray-800">
            취소·환불 수수료 규정
          </h3>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
            {terms.cancelFeeTerms}
          </div>
        </div>
      )}
    </section>
  )
}
