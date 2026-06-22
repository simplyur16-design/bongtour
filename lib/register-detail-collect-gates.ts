/**
 * 등록 상세카드 자동수집 — 축별 need* 게이트 SSOT (6공급사 공통).
 * LLM이 횟수·플래그만 채워도 structured 행이 없으면 API 수집을 시도한다.
 *
 * REGRESSION-FREEZE[register-detail-collect-gates]: split incl/excl/opt/shop gates — manifest
 */

export function substantiveRegisterBulletItems(items?: string[] | null): string[] {
  return (items ?? []).map((x) => String(x).trim()).filter((x) => x.length > 2)
}

export function needsRegisterIncludedCollect(parsed: {
  includedItems?: string[] | null
  includedText?: string | null
}): boolean {
  return substantiveRegisterBulletItems(parsed.includedItems).length === 0 && !parsed.includedText?.trim()
}

export function needsRegisterExcludedCollect(parsed: {
  excludedItems?: string[] | null
  excludedText?: string | null
}): boolean {
  return substantiveRegisterBulletItems(parsed.excludedItems).length === 0 && !parsed.excludedText?.trim()
}

export function needsRegisterIncludedExcludedCollect(parsed: {
  includedItems?: string[] | null
  includedText?: string | null
  excludedItems?: string[] | null
  excludedText?: string | null
}): boolean {
  return needsRegisterIncludedCollect(parsed) || needsRegisterExcludedCollect(parsed)
}

export function hasStructuredJsonRows(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false
  try {
    const arr = JSON.parse(raw) as unknown
    return Array.isArray(arr) && arr.length > 0
  } catch {
    return false
  }
}

export function needsRegisterShoppingCollect(args: {
  hasShoppingPaste: boolean
  shoppingStops: string | null | undefined
}): boolean {
  return !args.hasShoppingPaste && !hasStructuredJsonRows(args.shoppingStops)
}

export function needsRegisterOptionalCollect(args: {
  hasOptionalPaste: boolean
  optionalToursStructured: string | null | undefined
  hasOptionalTour?: boolean | null
  declaresNoOptional?: boolean
}): boolean {
  if (args.hasOptionalPaste || hasStructuredJsonRows(args.optionalToursStructured)) return false
  if (args.declaresNoOptional) return false
  if (args.hasOptionalTour === false) return false
  return true
}
