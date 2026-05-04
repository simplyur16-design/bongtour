/**
 * R-5 단위 검증: 봉투어 톤 예시 문자열·confirm 타이틀 페어.
 * 실행: npx tsx scripts/verify-bongtour-product-title-r5.ts
 */
import assert from 'node:assert/strict'
import {
  BONGTOUR_PRODUCT_TITLE_FORBIDDEN_TOKENS,
  sanitizeBongtourProductTitle,
  validateBongtourProductTitle,
} from '../lib/bongtour-product-title-tone-ssot'
import { productTitlePairForRegisterConfirm } from '../lib/bongtour-product-title-register-bridge'

const BONGTOUR_FIXTURE_TITLES = [
  '코카서스 3국(조지아·아제르바이잔·아르메니아)+두바이 10일 [KE 대한항공·인솔자 동행] 와이너리·꼬냑시음·10대특전',
  '다낭·호이안 5일 [대한항공·인솔자 동행] 호이안 메모리즈쇼·임프레션 테마파크·미슐랭',
  '도쿄·하코네·가와고에 4일 [직항] 온천욕·오다이바·아사쿠사·신주쿠·전망대',
  '[부산 출발] 다낭·호이안 5일 [KE 비즈니스 클래스 업그레이드·NO옵션]',
  '호치민 5일 [KE 대한항공·PRIVATE TOUR·전담 가이드] 미슐랭 4회·풀만 호텔 SPA·아브라 탑승',
  '동유럽 3~4개국(체코·헝가리·오스트리아) 9일 [노팁·노옵션·자유시간 포함]',
  '코카서스 3국 일주 9일 [TW 티웨이항공 직항] 조지아 와인·아르메니아 브랜디 투어',
  '도쿄 자유여행 3일 [신주쿠 숙박·트윈·조식 포함]',
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

const pair1 = productTitlePairForRegisterConfirm(
  { bongtourProductTitle: '  도쿄 3일 [직항] 온천  ' },
  '원본 긴 상품명 테스트'
)
assert.equal(pair1.prismaOriginalTitle, '원본 긴 상품명 테스트')
assert.ok(pair1.prismaTitle.includes('도쿄'))

const pairFallback = productTitlePairForRegisterConfirm({}, '공급사만')
assert.equal(pairFallback.prismaTitle, '공급사만')
assert.equal(pairFallback.prismaOriginalTitle, '공급사만')

console.log('verify-bongtour-product-title-r5: ok')
