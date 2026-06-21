/**
 * 등록 augment 단계 — imageKeyword/imageKeyword2 SSOT 재적용.
 * polish·extractPlaceNameKeyword 단독 덮어쓰기 금지(2순위 소실·공항 fallback 방지).
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot]
 */
import { extractDestinationFromTitle } from '@/lib/destination-from-title'
import { isRegisterAirtelListing } from '@/lib/register-admin-airtel-listing'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

type AugmentScheduleRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export function applyAugmentScheduleImageKeywordsBySupplier<
  T extends AugmentScheduleRow,
>(rows: T[], opts: {
  supplierKey: string
  productTitle?: string | null
  productDestination?: string | null
  travelScope?: string | null
  productType?: string | null
}): T[] {
  if (!rows.length) return rows
  if (isRegisterAirtelListing(opts.travelScope, opts.productType)) return rows
  const dest =
    (opts.productDestination ?? '').trim() ||
    extractDestinationFromTitle(String(opts.productTitle ?? ''))
  return applyRegisterScheduleImageKeywordsBySupplier(rows, {
    supplierKey: opts.supplierKey,
    productDestination: dest || null,
    productTitle: opts.productTitle ?? null,
    travelScope: opts.travelScope,
    productType: opts.productType,
  })
}
