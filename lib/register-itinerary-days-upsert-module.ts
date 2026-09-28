/**
 * Product.schedule → ItineraryDay upsert 모듈 선택 SSOT.
 * REGRESSION-FREEZE[register-itinerary-days-supplier-module]: naeiltour·lottetour·kyowontour 포함 — manifest
 */
import * as updItinHanatour from '@/lib/upsert-itinerary-days-hanatour'
import * as updItinModetour from '@/lib/upsert-itinerary-days-modetour'
import * as updItinVerygoodtour from '@/lib/upsert-itinerary-days-verygoodtour'
import * as updItinYbtour from '@/lib/upsert-itinerary-days-ybtour'
import * as updItinNaeiltour from '@/lib/upsert-itinerary-days-naeiltour'
import * as updItinLottetour from '@/lib/upsert-itinerary-days-lottetour'
import * as updItinKyowontour from '@/lib/upsert-itinerary-days-kyowontour'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

export function upsertItineraryModuleForProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}) {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource)
  const key = fromBrand || norm
  if (key === 'modetour' || norm === 'modetour') return updItinModetour
  if (key === 'verygoodtour' || norm === 'verygoodtour') return updItinVerygoodtour
  if (key === 'ybtour' || norm === 'ybtour') return updItinYbtour
  if (key === 'naeiltour' || norm === 'naeiltour') return updItinNaeiltour
  if (key === 'lottetour' || norm === 'lottetour') return updItinLottetour
  if (key === 'kyowontour' || norm === 'kyowontour') return updItinKyowontour
  if (key === 'hanatour' || norm === 'hanatour') return updItinHanatour
  return updItinHanatour
}
