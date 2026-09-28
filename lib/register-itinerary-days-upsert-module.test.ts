import { upsertItineraryModuleForProduct } from '@/lib/register-itinerary-days-upsert-module'
import * as updItinNaeiltour from '@/lib/upsert-itinerary-days-naeiltour'
import * as updItinLottetour from '@/lib/upsert-itinerary-days-lottetour'
import * as updItinKyowontour from '@/lib/upsert-itinerary-days-kyowontour'
import * as updItinHanatour from '@/lib/upsert-itinerary-days-hanatour'
import { describe, expect, it } from 'vitest'

// REGRESSION-FREEZE[register-itinerary-days-supplier-module]: 공급사별 ItineraryDay 모듈 — manifest

describe('upsertItineraryModuleForProduct', () => {
  it('routes naeiltour·lottetour·kyowontour to their modules', () => {
    expect(
      upsertItineraryModuleForProduct({ originSource: 'naeiltour', brand: null }),
    ).toBe(updItinNaeiltour)
    expect(
      upsertItineraryModuleForProduct({ originSource: 'lottetour', brand: null }),
    ).toBe(updItinLottetour)
    expect(
      upsertItineraryModuleForProduct({ originSource: 'kyowontour', brand: null }),
    ).toBe(updItinKyowontour)
    expect(
      upsertItineraryModuleForProduct({ originSource: 'hanatour', brand: null }),
    ).toBe(updItinHanatour)
  })
})
