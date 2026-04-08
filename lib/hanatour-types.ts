/**
 * 하나투어 수집 구조 타입 (JSON 직렬화 전 도메인 객체).
 * SQLite에는 문자열(JSON)로 저장한다.
 */

export type HanatourShoppingShopOption = {
  city?: string | null
  shopName?: string | null
  shopLocationRaw?: string | null
  itemCategoriesRaw?: string | null
  durationRaw?: string | null
  durationMinutes?: number | null
  sourceTextRaw?: string | null
}

export type HanatourOptionalTourItem = {
  title?: string | null
  descriptionRaw?: string | null
  adultPrice?: number | null
  childPrice?: number | null
  currency?: string | null
  durationRaw?: string | null
  alternativePlanRaw?: string | null
  guideAccompaniedIfNotSelected?: boolean | null
  minApplicants?: number | null
  specialIncludedNoteRaw?: string | null
  sourceTextRaw?: string | null
}

export type HanatourCardInstallmentBenefit = {
  cardCompanyName?: string | null
  installmentTitleRaw?: string | null
  applyStartDate?: string | null
  applyEndDate?: string | null
  excludedCardTypesRaw?: string | null
  contactPhone?: string | null
  detailsUrl?: string | null
  sourceTextRaw?: string | null
}

export type HanatourHanaExtraCard = {
  cardProductName?: string | null
  benefitBullets?: string[] | null
  sourceTextRaw?: string | null
  detailUrl?: string | null
}

export type HanatourMonthlyBenefitRecord = {
  supplierKey: string
  benefitMonth: string
  sourceUrl?: string | null
  isActive: boolean
  cardInstallmentBenefits: HanatourCardInstallmentBenefit[]
  hanaExtraCards: HanatourHanaExtraCard[]
  commonNoticesRaw?: string | null
  benefitSummaryRaw?: string | null
  fetchedAt?: Date | null
  rawMeta?: Record<string, unknown> | null
}

export type HanatourMatchTrace = {
  rawTitle?: string | null
  normalizedBaseTitle?: string | null
  variantLabelKey?: string | null
  airlineName?: string | null
  supplierProductCode?: string | null
  modalOpened?: boolean
  calendarDateCount?: number
  modalRowCount?: number
  matchedCandidateCount?: number
  selectedCandidateReason?: string | null
  conflict?: {
    currentBaseTitle?: string
    currentAirline?: string
    candidateTitles?: string[]
    candidateAirlines?: string[]
    selectedReason?: string
  }
}
