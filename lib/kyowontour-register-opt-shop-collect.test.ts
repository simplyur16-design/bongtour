/**
 * REGRESSION-FREEZE[kyowontour-tour-event-tab-opt-shop]
 */
import { describe, expect, it } from 'vitest'
import {
  kyowontourOptShopToFactShoppingPlaces,
  optShopParsedToRegisterFields,
} from './kyowontour-register-opt-shop-collect'
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

  it('null detail → unknown fields (not 0/false)', () => {
    const fields = optShopParsedToRegisterFields(parseKyowontourOptShopTabDetail(null))
    expect(fields.hasShopping).toBeNull()
    expect(fields.shoppingVisitCount).toBeNull()
    expect(fields.shoppingStops).toBeNull()
    expect(kyowontourOptShopToFactShoppingPlaces(parseKyowontourOptShopTabDetail(null))).toEqual([])
  })

  it('present empty tab → 명시 없음', () => {
    const parsed = parseKyowontourOptShopTabDetail({ evtType: [], etcTour: [] })
    const fields = optShopParsedToRegisterFields(parsed)
    expect(fields.hasShopping).toBe(false)
    expect(fields.shoppingVisitCount).toBe(0)
    expect(kyowontourOptShopToFactShoppingPlaces(parsed)).toEqual(['노쇼핑'])
  })
})
