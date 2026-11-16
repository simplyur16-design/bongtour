import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildTalktalkDraft, draftKeepsStoredFacts, finalizeTalktalkDraft } from '@/lib/talktalk-draft/draft'
import { ADMIN_DRAFT_FAQ, TALKTALK_FAQ_CATEGORIES, TALKTALK_FAQ_NEEDS_ANSWER, customerFaqBlob, faqCountByCategory } from '@/lib/talktalk-draft/faq'
import { inferTalktalkFaqCategory } from '@/lib/talktalk-draft/parse-inquiry'
import type { TalktalkCompareCandidate } from '@/lib/talktalk-draft/compare-candidates'

const candidate: TalktalkCompareCandidate = {
  productId: 'p1',
  title: '오사카 3박',
  href: '/products/osaka',
  supplierKey: 'hanatour',
  supplierLabel: '하나투어',
  departureDate: '2026-12-09',
  priceLabel: '900,000원',
  seatsLabel: '문의',
  adultKrw: 900000,
  seatCount: null,
}

describe('buildTalktalkDraft', () => {
  it('저장 가격·날짜·잔여석만 넣고 다른 금액을 만들지 않는다', () => {
    const { text, faq } = buildTalktalkDraft({
      inquiryText: '오사카 취소 가능한가요',
      placeLabel: '오사카',
      weekStartYmd: '2026-12-07',
      weekFellBack: false,
      durationNote: false,
      candidates: [candidate],
    })
    expect(text).toContain('성인 요금: 900,000원')
    expect(text).toContain('출발일: 2026-12-09')
    expect(text).toContain('잔여석: 문의')
    expect(text).not.toMatch(/1,000,000원|취소수수료\s*\d+/)
    expect(text).toContain('발송하지 않았습니다')
    expect(faq.some((item) => item.source === 'app/terms/page.tsx')).toBe(true)
    expect(draftKeepsStoredFacts(text, text, [candidate])).toBe(true)
  })

  it('문장 다듬기가 가격을 바꾸면 초안을 되돌린다', () => {
    const original = buildTalktalkDraft({
      inquiryText: '예약 확정인가요',
      placeLabel: '오사카',
      weekStartYmd: '2026-12-07',
      weekFellBack: false,
      durationNote: true,
      candidates: [candidate],
    }).text
    const kept = finalizeTalktalkDraft(original, [candidate], (text) => text.replace('900,000원', '700,000원'))
    expect(kept).toBe(original)
    expect(kept).not.toContain('700,000원')
  })

  it('고객에게 보이는 질문·답과 초안에 공급사 이름이 없다', () => {
    const blob = customerFaqBlob()
    expect(blob).not.toMatch(/유심사|usimsa/i)
    const text = buildTalktalkDraft({
      inquiryText: '아이폰 eSIM QR 설치가 안 돼요',
      placeLabel: null,
      weekStartYmd: null,
      weekFellBack: false,
      durationNote: true,
      candidates: [],
    }).text
    expect(text).not.toMatch(/유심사|usimsa/i)
    expect(text).toMatch(/설치|QR/)
    expect(ADMIN_DRAFT_FAQ.some((item) => item.sourceNote?.includes('BDT002') || item.source.includes('BDT002'))).toBe(true)
    expect(blob).not.toMatch(/A54|발급 전만|귀국 후/)
    expect(blob).toContain('상품 안내 또는 고객센터')
    expect(TALKTALK_FAQ_NEEDS_ANSWER.map((item) => item.question).join('\n')).not.toMatch(/APN에 어떤 주소/)
    expect(blob).not.toMatch(/하나투어|모두투어|노랑풍선|참좋은|교원투어|롯데관광|내일투어|한진관광|hanatour|modetour|ybtour|verygoodtour/i)
    const counts = faqCountByCategory()
    for (const category of TALKTALK_FAQ_CATEGORIES) {
      expect(counts[category.id]).toBeGreaterThan(0)
    }
    for (const item of ADMIN_DRAFT_FAQ) {
      const nums = item.answer.match(/\d+/g) ?? []
      if (!item.source.includes('/')) continue
      const src = readFileSync(item.source, 'utf8')
      for (const n of nums) expect(src, `${item.id} ${n}`).toContain(n)
    }
    expect(inferTalktalkFaqCategory('국외연수 견적 부탁드립니다')).toBe('training')
    expect(inferTalktalkFaqCategory('eSIM QR이 안 와요')).toBe('esim')
  })

  it('근거 없는 질문은 초안 문장으로 넣지 않고 답 필요 목록에만 둔다', () => {
    const blob = ADMIN_DRAFT_FAQ.map((item) => item.answer).join('\n')
    for (const need of TALKTALK_FAQ_NEEDS_ANSWER) {
      expect(blob).not.toContain(need.question)
    }
    expect(TALKTALK_FAQ_NEEDS_ANSWER.map((item) => item.question)).toEqual(
      expect.arrayContaining([
        '여권 잔여 유효기간은 얼마나 있어야 하나요?',
        '출발 며칠 전 취소 수수료는 몇 %인가요?',
      ]),
    )
  })

  it('초안 모듈은 발송 코드를 가져오지 않는다', () => {
    const src = readFileSync('lib/talktalk-draft/draft.ts', 'utf8')
    expect(src).toContain('REGRESSION-FREEZE[talktalk-draft-no-send-no-price-invent]')
    expect(src).not.toMatch(/sendStaffInquiryReply|solapi|openai|fetch\(/)
  })
})
