/**
 * Plan B 등록 상품명 — 원문 노출·confirm 페어·마케팅 opt-in.
 * 실행: npx tsx scripts/verify-supplier-product-title-plan-b.ts
 */
import assert from 'node:assert/strict'
import {
  isBongtourMarketingTitleSaveRequested,
  productTitlePairForRegisterConfirm,
} from '../lib/bongtour-product-title-register-bridge'
import { buildProductPublicSeoDocumentTitle } from '../lib/product-public-seo-title'
import {
  buildSupplierProductDisplayTitle,
  resolveSupplierVerbatimOriginalTitle,
  SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION,
} from '../lib/supplier-product-title-display'
import { isSupplierListingTitleUnacceptable } from '../lib/supplier-listing-title-unacceptable'

assert.match(SUPPLIER_PRODUCT_TITLE_DISPLAY_POLICY_VERSION, /^plan-b-v/)

const original =
  '코카서스 3국 10일 KE #두바이관광 #인솔자동행 #10대특전'

const display = buildSupplierProductDisplayTitle({
  verbatimOriginal: original,
  brandKey: 'hanatour',
})
assert.ok(display.includes('#두바이관광'), 'display must keep supplier hashtags')
assert.ok(!/^코카서스 3국 두바이 \d+박/.test(display), 'must not be R-5 marketing compose only')

const pairDefault = productTitlePairForRegisterConfirm(
  { bongtourProductTitle: '일본 도쿄 3일 [직항]' },
  {
    parsedSupplierTitle: original,
    supplierListingTitleRaw: original,
    brandKey: 'hanatour',
  },
)
assert.equal(pairDefault.prismaOriginalTitle, original)
assert.equal(pairDefault.prismaTitle, display)
assert.ok(!pairDefault.prismaTitle.includes('일본 도쿄 3일'), 'bongtour suggestion must not auto-save')

assert.equal(isBongtourMarketingTitleSaveRequested({}), false)
assert.equal(isBongtourMarketingTitleSaveRequested({ productTitleSaveMode: 'bongtour_marketing' }), true)

const pairMarketing = productTitlePairForRegisterConfirm(
  {
    productTitleSaveMode: 'bongtour_marketing',
    bongtourProductTitle: '일본 도쿄·하코네 3박 4일',
  },
  { parsedSupplierTitle: original, brandKey: 'hanatour' },
)
assert.ok(pairMarketing.prismaTitle.includes('도쿄'))

const seo = buildProductPublicSeoDocumentTitle({
  displayTitle: pairDefault.prismaTitle,
  originalTitle: pairDefault.prismaOriginalTitle,
  primaryDestination: '두바이',
  duration: '9박 10일',
})
assert.ok(seo.includes('|'))
assert.ok(seo.includes('여행 상품'))

const badWindow = '2026.06.15 ~ 2026.06.17 2박 3일'
assert.equal(isSupplierListingTitleUnacceptable(badWindow), true)
assert.equal(
  resolveSupplierVerbatimOriginalTitle({
    parsedSupplierTitle: badWindow,
    supplierListingTitleRaw: badWindow,
    brandKey: 'hanatour',
  }),
  '미입력',
)
assert.equal(
  buildSupplierProductDisplayTitle({
    verbatimOriginal: '미입력',
    parsedSupplierTitle: badWindow,
    brandKey: 'hanatour',
  }),
  '미입력',
)

console.log('verify-supplier-product-title-plan-b: ok')
