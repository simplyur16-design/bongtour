/**
 * fix 3b — per-supplier shopping extract → 있음(N회) / 없음 (unknown 금지 경로)
 */
import { describe, expect, it } from 'vitest'
import { extractHanatourShoppingFromProdInfo } from '@/lib/hanatour-register-api-detail'
import { finalizeHanatourRegisterParsedShopping } from '@/lib/register-hanatour-shopping'
import { extractModetourShoppingFromDetailBundle } from '@/lib/modetour-register-api-detail'
import { extractYbtourShoppingFromNoticeAndSchedule } from '@/lib/ybtour-register-api-detail'
import {
  extractLottetourShoppingFromSpotListAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
} from '@/lib/lottetour-register-api-detail'
import { extractVerygoodOptionalShoppingFromDetailHtml } from '@/lib/verygoodtour-register-api-detail'
import {
  CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE,
  parseKyowontourOptShopTabDetail,
} from '@/lib/kyowontour-tour-event-tab-data'
import { optShopParsedToRegisterFields } from '@/lib/kyowontour-register-opt-shop-collect'
import { extractNaeiltourOptionalShoppingFromTab0 } from '@/lib/naeiltour-register-api-detail'
import { shoppingScalarsFromRegisterParsed } from '@/lib/supplier-product-fact-ssot'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import { MODETOUR_AVP603_HEADER_SNIPPET } from '../scripts/fixtures/modetour-avp603twa1.fixture'
import { HANATOUR_ATP207_HEADER_SNIPPET } from '../scripts/fixtures/hanatour-atp207260601twj.fixture'

describe('hanatour shopping extract (prodInfo shpnCntrVistCnt)', () => {
  it('visitCount 0 → 없음 scalars; finalize keeps API when paste empty', () => {
    const shop = extractHanatourShoppingFromProdInfo({
      shpnCntrVistCnt: 0,
      shpnInfoList: [],
    } as never)
    expect(shop.visitCount).toBe(0)
    const parsed = {
      hasShopping: false,
      shoppingVisitCount: 0,
      shoppingSummaryText: '쇼핑 없음',
      detailBodyStructured: { raw: { shoppingPasteRaw: null }, shoppingStructured: { rows: [] } },
    } as unknown as RegisterParsed
    const fin = finalizeHanatourRegisterParsedShopping(parsed)
    expect(fin.hasShopping).toBe(false)
    expect(fin.shoppingVisitCount).toBe(0)
    expect(shoppingScalarsFromRegisterParsed(fin)).toEqual({
      shoppingCount: 0,
      shoppingVisitCountTotal: 0,
    })
  })

  it('visitCount 2 + rows → finalize preserves without paste', () => {
    const shop = extractHanatourShoppingFromProdInfo({
      shpnCntrVistCnt: 2,
      shpnInfoList: [
        { shpnPlcNm: '면세점', shpnItemNm: '화장품' },
        { shpnPlcNm: '아울렛', shpnItemNm: '의류' },
      ],
    } as never)
    expect(shop.visitCount).toBe(2)
    expect(shop.rows.length).toBe(2)
    const parsed = {
      hasShopping: true,
      shoppingVisitCount: 2,
      shoppingStops: JSON.stringify(shop.rows),
      shoppingSummaryText: '쇼핑 2회',
      detailBodyStructured: { raw: { shoppingPasteRaw: '' }, shoppingStructured: { rows: [] } },
    } as unknown as RegisterParsed
    const fin = finalizeHanatourRegisterParsedShopping(parsed)
    expect(fin.hasShopping).toBe(true)
    expect(fin.shoppingVisitCount).toBe(2)
  })

  it('fixture header 쇼핑없음 is a body signal (not invent 있음)', () => {
    expect(HANATOUR_ATP207_HEADER_SNIPPET).toMatch(/쇼핑없음/)
  })
})

describe('modetour shopping extract (shoppingTimes / shoppingCount)', () => {
  it('shoppingTimes 3 → visit 3; 0 → noShoppingFlag', () => {
    expect(
      extractModetourShoppingFromDetailBundle({ shoppingTimes: 3 }, { shoppingCount: 0 }),
    ).toEqual({ shoppingVisitCount: 3, noShoppingFlag: false })
    expect(
      extractModetourShoppingFromDetailBundle({ shoppingTimes: 0 }, null),
    ).toEqual({ shoppingVisitCount: 0, noShoppingFlag: true })
  })

  it('fixture header 쇼핑 3회', () => {
    expect(MODETOUR_AVP603_HEADER_SNIPPET).toMatch(/쇼핑\s*3회/)
  })
})

describe('ybtour shopping extract (notice.shopCnt)', () => {
  it('shopCnt 0 → visit 0; shopCnt 2 → visit 2', () => {
    expect(
      extractYbtourShoppingFromNoticeAndSchedule({ shopCnt: 0, shopInfo: '' } as never, []),
    ).toMatchObject({ visitCount: 0 })
    expect(
      extractYbtourShoppingFromNoticeAndSchedule({ shopCnt: 2, shopInfo: '' } as never, []),
    ).toMatchObject({ visitCount: 2 })
  })
})

describe('lottetour shopping extract (포함된 쇼핑횟수 / shopCnt)', () => {
  const CORE = `
<table><tr><th>포함된 쇼핑횟수</th><td>2회</td></tr></table>`
  const ZERO_CORE = `
<table><tr><th>포함된 쇼핑횟수</th><td>0회</td></tr></table>`
  const SPOT = `
<div class="travel_info_cont"><!-- 쇼핑 -->
  <p>총 <span id="shopCnt">2</span>회의 쇼핑</p>
  <table class="table"><tbody>
    <tr><td>1</td><td>침향</td><td>샵A</td><td>1시간</td><td>Y</td></tr>
    <tr><td>2</td><td>커피</td><td>샵B</td><td>1시간</td><td>Y</td></tr>
  </tbody></table>
</div><!-- //travel_info_cont : 쇼핑 -->`

  it('coreInfo 2회 / 0회', () => {
    expect(extractLottetourShoppingVisitCountFromCoreInfo(CORE)).toBe(2)
    expect(extractLottetourShoppingVisitCountFromCoreInfo(ZERO_CORE)).toBe(0)
  })

  it('spotList visit + rows', () => {
    const r = extractLottetourShoppingFromSpotListAjax(SPOT)
    expect(r.visitCount).toBe(2)
    expect(r.rows.length).toBe(2)
  })
})

describe('verygoodtour shopping extract (헤더 쇼핑 N회)', () => {
  it('쇼핑 1회 → hasShopping + visit 1', () => {
    const html = `<div>쇼핑 1회</div><div>쇼핑횟수 총 1회</div>
      <table><caption>쇼핑안내리스트</caption>
      <tr><td>1</td><td>면세</td><td>시내면세점</td><td>1시간</td><td>Y</td></tr></table>`
    const r = extractVerygoodOptionalShoppingFromDetailHtml(html)
    expect(r.hasShopping).toBe(true)
    expect(r.shoppingVisitCount).toBeGreaterThanOrEqual(1)
  })

  it('쇼핑 0회 / 쇼핑없음 → 없음', () => {
    const zero = extractVerygoodOptionalShoppingFromDetailHtml('<div>쇼핑 0회</div>')
    expect(zero.hasShopping).toBe(false)
    expect(zero.shoppingVisitCount).toBe(0)
    const none = extractVerygoodOptionalShoppingFromDetailHtml('<div>쇼핑없음 노쇼핑</div>')
    expect(none.hasShopping).toBe(false)
    expect(none.shoppingVisitCount).toBe(0)
  })
})

describe('kyowontour shopping extract (goodsEvtTab_7 shopping_list)', () => {
  it('CSP302 fixture → 있음(2회)', () => {
    const parsed = parseKyowontourOptShopTabDetail(CSP302_OPT_SHOP_TAB7_DETAIL_FIXTURE)
    expect(parsed.shoppingItems.length).toBe(2)
    expect(parsed.shoppingVisitCount).toBe(2)
    const fields = optShopParsedToRegisterFields(parsed)
    expect(fields.hasShopping).toBe(true)
    expect(fields.shoppingVisitCount).toBe(2)
  })

  it('empty shopping_list → 없음(0)', () => {
    const parsed = parseKyowontourOptShopTabDetail({ evtType: [], etcTour: [] })
    const fields = optShopParsedToRegisterFields(parsed)
    expect(fields.hasShopping).toBe(false)
    expect(fields.shoppingVisitCount).toBe(0)
  })
})

describe('naeiltour shopping extract (탭0 쇼핑정보) — inline markup matching extractIncluExcluBlock; no scripts/fixtures sample', () => {
  it('쇼핑정보 블록 쇼핑 2회 → visit 2', () => {
    const html = `<p class="title">쇼핑정보</p><div class="cont">시내 쇼핑 2회 예정</div>`
    const r = extractNaeiltourOptionalShoppingFromTab0(html)
    expect(r.hasShopping).toBe(true)
    expect(r.shoppingVisitCount).toBe(2)
  })

  it('쇼핑정보 쇼핑없음 → visit 0', () => {
    const html = `<p class="title">쇼핑정보</p><div class="cont">쇼핑없음</div>`
    const r = extractNaeiltourOptionalShoppingFromTab0(html)
    expect(r.hasShopping).toBe(false)
    expect(r.shoppingVisitCount).toBe(0)
  })
})
