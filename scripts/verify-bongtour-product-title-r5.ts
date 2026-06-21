/**
 * R-5 단위 검증: 봉투어 톤 예시 문자열·마케팅 opt-in confirm.
 * 실행: npx tsx scripts/verify-bongtour-product-title-r5.ts
 */
import assert from 'node:assert/strict'
import {
  BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS,
  sanitizeBongtourProductTitle,
  validateBongtourProductTitle,
} from '../lib/bongtour-product-title-tone-ssot'
import { composeMarketingProductTitle } from '../lib/bongtour-product-title-marketing-compose'
import { productTitlePairForRegisterConfirm } from '../lib/bongtour-product-title-register-bridge'

/** v2 마케팅 노출 형식(국가/권역 + 도시 + N박M일·N일) — R-5 제안명 전용 */
const BONGTOUR_FIXTURE_TITLES = [
  '코카서스 3국 두바이 10일 [KE 대한항공·인솔자 동행]',
  '베트남 다낭·호이안 4박 5일 [대한항공]',
  '일본 도쿄·하코네 4일 [직항]',
  '베트남 다낭·호이안 5일 [KE 비즈니스·NO옵션]',
  '베트남 호치민 5일 [KE 대한항공]',
  '동유럽 체코·헝가리 9일 [노팁·노옵션]',
  '코카서스 3국 일주 9일 [TW 티웨이항공 직항]',
  '일본 도쿄 3일 [신주쿠 숙박]',
]

for (const raw of BONGTOUR_FIXTURE_TITLES) {
  const s = sanitizeBongtourProductTitle(raw)
  const v = validateBongtourProductTitle(s)
  assert.equal(v.ok, true, `validate fail: ${raw} -> issues=${v.issues.join(';')}`)
  for (const tok of BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS) {
    if (!tok.trim()) continue
    assert.equal(
      s.toLowerCase().includes(tok.toLowerCase()),
      false,
      `forbidden token "${tok}" still in: ${s}`
    )
  }
}

const composed = composeMarketingProductTitle({
  originalProductTitle:
    '다낭·호이안 5일 [대한항공] 호이안 메모리즈쇼·임프레션·미슐랭',
  destination: '다낭',
  duration: null,
})
assert.ok(composed.includes('다낭'))
assert.ok(/4박\s*5일|5일/.test(composed))

const pairOptIn = productTitlePairForRegisterConfirm(
  {
    productTitleSaveMode: 'bongtour_marketing',
    bongtourProductTitle: '  일본 도쿄 3일 [직항]  ',
  },
  '원본 긴 상품명 테스트'
)
assert.equal(pairOptIn.prismaOriginalTitle, '원본 긴 상품명 테스트')
assert.ok(pairOptIn.prismaTitle.includes('도쿄'))

const pairPlanB = productTitlePairForRegisterConfirm(
  { bongtourProductTitle: '일본 도쿄 3일 [직항]' },
  '공급사 원문 #노옵션 5일'
)
assert.equal(pairPlanB.prismaTitle, '공급사 원문 5일')
assert.equal(pairPlanB.prismaOriginalTitle, '공급사 원문 #노옵션 5일')

console.log('verify-bongtour-product-title-r5: ok')
