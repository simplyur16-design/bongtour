import { getBrandLabel } from '@/lib/brands'

const BONGTOUR_NAME = 'Bong투어'
const ORGANIZER_DISCLAIMER =
  '본 상품은 [브랜드명]의 상품으로, 실제 행사는 해당 여행사와 현지 랜드사에서 진행합니다.'

type Props = {
  brandKey: string | null | undefined
  /** DB Brand.displayName. 없으면 getBrandLabel(brandKey) 사용 */
  brandDisplayName?: string | null
}

/**
 * 상품 페이지 상단: 여행 주최 / 판매 대행 구분 + 고정 면피 문구.
 */
export default function OrganizerNotice({ brandKey, brandDisplayName }: Props) {
  const label = brandDisplayName ?? getBrandLabel(brandKey) ?? '해당 여행사'
  const disclaimer = ORGANIZER_DISCLAIMER.replace('[브랜드명]', label)

  return (
    <section className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="font-medium text-gray-700">
          여행 주최: <strong className="text-gray-900">{label}</strong>
        </span>
        <span className="text-gray-400">|</span>
        <span className="font-medium text-gray-700">
          판매 대행: <strong className="text-gray-900">{BONGTOUR_NAME}</strong>
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-gray-600">{disclaimer}</p>
    </section>
  )
}
