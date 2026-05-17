export type ItineraryExtraInfoProduct = {
  productType?: string | null
  includedText?: string | null
  excludedText?: string | null
  optionalToursStructured?: string | null
  shoppingCount?: number | null
  shoppingItems?: string | null
  shoppingCautionNoticeRaw?: string | null
  reservationNoticeRaw?: string | null
}

type OptionalTourRow = {
  name?: string
  currency?: string
  adultPrice?: number | string
  childPrice?: number | string | null
  minPaxText?: string | null
  'guide同行Text'?: string | null
  waitingPlaceText?: string | null
}

type ItineraryExtraInfoSection = 'top' | 'bottom' | 'all'

export function ItineraryExtraInfoBoxes({
  product,
  section = 'all',
}: {
  product: ItineraryExtraInfoProduct
  section?: ItineraryExtraInfoSection
}) {
  const showTop = section === 'top' || section === 'all'
  const showBottom = section === 'bottom' || section === 'all'
  const includedItems = (product.includedText ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const excludedItems = (product.excludedText ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const reservationNotices = (product.reservationNoticeRaw ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)

  const optionalTours = (() => {
    try {
      const parsed = product.optionalToursStructured ? JSON.parse(product.optionalToursStructured) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })() as OptionalTourRow[]

  const shoppingItems = (product.shoppingItems ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const isAirtel = product.productType === 'airtel'

  return (
    <div className="space-y-2">
      {showTop && includedItems.length > 0 && (
        <section className="mb-4">
          <div className="border-l-4 border-[#6B8E5C] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">포함 사항</h3>
          </div>
          <ul className="bg-green-50 rounded-2xl p-4 space-y-2">
            {includedItems.map((item, i) => (
              <li key={i} className="text-sm fit-tx-primary">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showTop && excludedItems.length > 0 && (
        <section className="mb-4">
          <div className="border-l-4 border-[#D85A30] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">불포함 사항</h3>
          </div>
          <ul className="bg-orange-50 rounded-2xl p-4 space-y-2">
            {excludedItems.map((item, i) => (
              <li key={i} className="text-sm fit-tx-primary">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {showBottom && !isAirtel && optionalTours.length > 0 && (
        <section className="mb-6">
          <div className="border-l-4 border-[#1F1B2D] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">현지 옵션</h3>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">옵션명</th>
                  <th className="px-3 py-2 text-right font-medium">성인가</th>
                  <th className="px-3 py-2 text-right font-medium">아동가</th>
                  <th className="px-3 py-2 text-center font-medium">최소인원</th>
                  <th className="px-3 py-2 text-center font-medium">가이드</th>
                  <th className="px-3 py-2 text-left font-medium">대기 장소</th>
                </tr>
              </thead>
              <tbody>
                {optionalTours.map((t, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 whitespace-nowrap">{t.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.currency}
                      {t.adultPrice}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {t.childPrice ? `${t.currency}${t.childPrice}` : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">{t.minPaxText || '-'}</td>
                    <td className="px-3 py-2 text-center">{t['guide同行Text'] || '-'}</td>
                    <td className="px-3 py-2">{t.waitingPlaceText || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {showBottom && !isAirtel && Boolean(product.shoppingCount) && shoppingItems.length > 0 && (
        <section className="mb-6">
          <div className="border-l-4 border-[#E89571] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">
              쇼핑 정보{' '}
              <span className="text-sm font-normal text-gray-500 ml-2">총 {product.shoppingCount}회</span>
            </h3>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-center font-medium w-16">#</th>
                  <th className="px-3 py-2 text-left font-medium">쇼핑 품목</th>
                </tr>
              </thead>
              <tbody>
                {shoppingItems.map((item, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-center tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2">{item}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {product.shoppingCautionNoticeRaw ? (
            <p className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{product.shoppingCautionNoticeRaw}</p>
          ) : null}
        </section>
      )}

      {showBottom && reservationNotices.length > 0 && (
        <section className="mb-4">
          <div className="border-l-4 border-[#8B8B95] pl-3 mb-2">
            <h3 className="text-base font-bold fit-tx-primary">꼭 알아야 할 사항</h3>
          </div>
          <ul className="bg-gray-50 rounded-2xl p-4 space-y-2">
            {reservationNotices.map((item, i) => (
              <li key={i} className="text-sm fit-tx-primary">
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
