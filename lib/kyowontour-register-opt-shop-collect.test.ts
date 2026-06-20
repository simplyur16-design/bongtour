/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]
 */
import { describe, expect, it } from 'vitest'
import { optShopParsedToRegisterFields } from './kyowontour-register-opt-shop-collect'
import { CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE, parseKyowontourOptShopTabDetail } from './kyowontour-tour-event-tab-data'

describe('kyowontour register opt/shop collect mapping', () => {
  it('maps etcTour·shopping_list to register JSON fields', () => {
    const parsed = parseKyowontourOptShopTabDetail(CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE)
    const fields = optShopParsedToRegisterFields(parsed)
    expect(fields.optionalToursStructured).toBeTruthy()
    expect(fields.shoppingStops).toBeTruthy()
    const opt = JSON.parse(fields.optionalToursStructured!) as Array<{ name: string }>
    const shop = JSON.parse(fields.shoppingStops!) as Array<{ itemName: string }>
    expect(opt).toHaveLength(6)
    expect(shop).toHaveLength(2)
    expect(shop[0]?.itemName).toBe('보이차')
  })
})
