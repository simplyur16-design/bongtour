import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { extractStructuredTourSignals } from '@/lib/structured-tour-signals-ybtour'
import { ybtourHaystackDeclaresNoShopping } from '@/lib/register-ybtour-shopping'

const CPP1063_SNIPPET = `
[아시아나/인천출발] 상해/오진 4일 #TOP PICK #노팁노옵션노쇼핑 #4명부터단독
모든 경비가 포함된 NO쇼핑/NO옵션/NO팁 상품입니다.
쇼핑 없음
옵션/쇼핑/관광
총 6회
회차	항목명	비용·시간
1	[아시아나/인천출발] 상해/오진 4일 #TOP PICK #노팁노옵션노쇼핑 #4명부터단독	—
2	모든 경비가 포함된 NO쇼핑/NO옵션/NO팁 상품입니다.	—
3	쇼핑 없음	—
4	옵션/쇼핑/관광	—
5	- 노쇼핑 / 노옵션 / 가이드+기사 경비 포함	—
6	■ 쇼핑센터 : 노쇼핑 일정입니다.	—
■ 쇼핑센터 : 노쇼핑 일정입니다.
`.trim()

describe('ybtour shopping — dedicated paste empty SSOT', () => {
  it('노쇼핑 본문은 no-shopping으로 판정한다', () => {
    assert.equal(ybtourHaystackDeclaresNoShopping(CPP1063_SNIPPET), true)
  })

  it('옵션/쇼핑 탭 메타 표(총 6회)만 있으면 쇼핑 회차·횟수를 만들지 않는다', () => {
    const sig = extractStructuredTourSignals(CPP1063_SNIPPET)
    assert.equal(sig.hasShopping, false)
    assert.equal(sig.shoppingVisitCount, null)
    assert.equal(sig.shoppingStops.length, 0)
    assert.equal(sig.shoppingSummaryText, '쇼핑 없음')
  })
})
