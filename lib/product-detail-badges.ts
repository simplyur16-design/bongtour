import {
  buildPublicOptionalDisplayInputFromProductFields,
  buildPublicShoppingDisplayInputFromProductFields,
  type ShoppingStopRow,
  shouldShowPublicOptionalSection,
  shouldShowPublicShoppingSection,
} from '@/lib/public-product-extras'

/** TravelProduct과 호환되는 최소 필드 (순환 참조 방지) */
export type ProductBadgeInput = {
  optionalToursStructured?: string | null
  optionalTourNoticeItems?: string[]
  optionalTourNoticeRaw?: string | null
  optionalTourDisplayNoticeFinal?: string | null
  optionalToursPasteRaw?: string | null
  optionalTours?: { id: string }[]
  shoppingCount?: number | null
  shoppingVisitCountTotal?: number | null
  shoppingItems?: string | null
  shoppingStopsStructured?: { itemType: string }[] | null
  shoppingNoticeRaw?: string | null
  shoppingPasteRaw?: string | null
  freeTimeSummaryText?: string | null
  hasFreeTime?: boolean | null
  hasOptionalTours?: boolean | null
  schedule?: { description?: string }[] | null
  includedText?: string | null
  excludedText?: string | null
}

/** 배지/메타칩에서 자유시간 문구 추론 시 재사용 */
export function inferFreeTimeFromSchedule(p: ProductBadgeInput): string | null {
  const blob = [
    ...(p.schedule ?? []).map((d) => `${d.description ?? ''}`),
    p.includedText ?? '',
    p.excludedText ?? '',
  ].join('\n')
  if (!/(자유시간|개별시간|자유\s*일정|자유관광|개별\s*관광)/i.test(blob)) return null
  if (/하루|1일|전일/.test(blob)) return '자유시간 하루'
  if (/반나절|오후|오전/.test(blob)) return '자유시간 반나절'
  return '자유시간 있음'
}

/** 공개 상세 상단 배지 — 값이 없으면 해당 배지 생략 */
export function buildPublicProductBadges(product: ProductBadgeInput): string[] {
  const badges: string[] = []
  const optionalDisplayInput = buildPublicOptionalDisplayInputFromProductFields({
    optionalToursStructured: product.optionalToursStructured,
    optionalTourNoticeItems: product.optionalTourNoticeItems,
    optionalTourNoticeRaw: product.optionalTourNoticeRaw,
    optionalTourDisplayNoticeFinal: product.optionalTourDisplayNoticeFinal,
    optionalToursPasteRaw: product.optionalToursPasteRaw,
    optionalTours: product.optionalTours,
  })
  const hasOptionalTabContent = shouldShowPublicOptionalSection(optionalDisplayInput)

  if (product.hasOptionalTours === true || hasOptionalTabContent) {
    badges.push('현지옵션 있음')
  } else if (product.hasOptionalTours === false && !hasOptionalTabContent) {
    badges.push('현지옵션 없음')
  }

  const visit =
    product.shoppingVisitCountTotal != null && product.shoppingVisitCountTotal >= 0
      ? product.shoppingVisitCountTotal
      : product.shoppingCount != null && product.shoppingCount >= 0
        ? product.shoppingCount
        : null
  const shoppingDisplayInput = buildPublicShoppingDisplayInputFromProductFields({
    shoppingStopsStructured: product.shoppingStopsStructured as ShoppingStopRow[] | null | undefined,
    shoppingVisitCountTotal: product.shoppingVisitCountTotal,
    shoppingCount: product.shoppingCount,
    shoppingItems: product.shoppingItems,
    shoppingNoticeRaw: product.shoppingNoticeRaw,
    shoppingPasteRaw: product.shoppingPasteRaw,
  })
  const hasShoppingTabContent = shouldShowPublicShoppingSection(shoppingDisplayInput)

  if (visit != null) {
    if (visit > 0) badges.push(`쇼핑 ${visit}회`)
    else if (visit === 0 && !hasShoppingTabContent) badges.push('쇼핑 없음')
    else if (visit === 0 && hasShoppingTabContent) badges.push('쇼핑 있음')
  } else if (hasShoppingTabContent) {
    badges.push('쇼핑 있음')
  }

  if (product.freeTimeSummaryText?.trim()) {
    badges.push(product.freeTimeSummaryText.trim())
  } else if (product.hasFreeTime === false) {
    badges.push('자유시간 없음')
  } else if (product.hasFreeTime === true) {
    const inferred = inferFreeTimeFromSchedule(product)
    badges.push(inferred ?? '자유시간 있음')
  } else {
    const inferred = inferFreeTimeFromSchedule(product)
    if (inferred) badges.push(inferred)
  }

  return badges
}
