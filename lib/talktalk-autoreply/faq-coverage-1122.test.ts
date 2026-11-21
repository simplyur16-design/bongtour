import { describe, expect, it } from 'vitest'
import { ADMIN_DRAFT_FAQ } from '@/lib/talktalk-draft/faq'
import { selectAutoReplyFaq } from '@/lib/talktalk-autoreply/reply'

const CASES: Array<[string, string]> = [
  ['다음달 15일 출발 자리 남아 있나요?', 'faq-seat-left'],
  ['이 날짜 출발 확정인가요?', 'faq-departure-confirmed'],
  ['요금에 뭐가 포함되어 있나요? 불포함은요?', 'faq-included'],
  ['유류할증료 포함인가요?', 'faq-fuel-surcharge'],
  ['가이드 팁은 따로 내나요?', 'faq-guide-tip'],
  ['쇼핑 일정 있나요?', 'faq-shopping-schedule'],
  ['선택관광 필수인가요?', 'boss-optional-tour'],
  ['1인실 추가 금액 얼마예요?', 'boss-single-room'],
  ['아동 요금은 얼마인가요?', 'boss-child-age'],
  ['여권 유효기간 얼마나 남아야 해요?', 'boss-passport-remain'],
  ['취소 수수료가 얼마인가요?', 'boss-cancel-fee'],
  ['카드 할부 되나요?', 'inquiry-installment'],
]

describe('talktalk faq coverage 1122', () => {
  it.each(CASES)('%s -> %s', (text, id) => {
    expect(selectAutoReplyFaq(text, 2).map((i) => i.id)).toContain(id)
  })

  it('answers are full sentences, no supplier placeholder, no 유심사', () => {
    for (const item of ADMIN_DRAFT_FAQ) {
      expect(item.answer.length, item.id).toBeGreaterThanOrEqual(15)
      expect(item.answer).not.toMatch(/유심사|\[브랜드명\]/)
      expect(item.question).not.toMatch(/유심사/)
    }
  })
})
