/**
 * modetour 긴급모객 — supplier-urgent-deal re-export (레거시 import 경로 유지).
 */
export {
  SUPPLIER_URGENT_DEAL_WINDOW_DAYS as MODETOUR_URGENT_DEAL_WINDOW_DAYS,
  SUPPLIER_URGENT_DEAL_MIN_PRICE_KRW as MODETOUR_URGENT_DEAL_MIN_PRICE_KRW,
  isValidUrgentDealPrice as isValidModetourUrgentDealPrice,
  departureDateToYmd,
  computeBaselineAdultPriceOnUpsert,
  isUrgentDealDeparture as isModetourUrgentDealDeparture,
  pickNearestUrgentDealDeparture as pickNearestModetourUrgentDealDeparture,
  syncSupplierUrgentDealForProduct as syncModetourUrgentDealForProduct,
  type UrgentDealDepartureRow,
  type UrgentDealNearest as ModetourUrgentDealNearest,
  type SupplierUrgentDealSyncResult as ModetourUrgentDealSyncResult,
} from '@/lib/supplier-urgent-deal'
