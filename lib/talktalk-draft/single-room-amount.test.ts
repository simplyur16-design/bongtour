import { describe, expect, it } from 'vitest'
import { buildTalktalkDraft } from '@/lib/talktalk-draft/draft'
import {
  SINGLE_ROOM_CONFIRM_LATER,
  singleRoomAmountLabelFromStored,
} from '@/lib/talktalk-draft/single-room-amount'

describe('singleRoomAmountLabelFromStored', () => {
  it('공급사 원문 금액과 통화를 그대로 쓴다', () => {
    expect(
      singleRoomAmountLabelFromStored({
        raw: '싱글차지 USD 150',
        amount: 150000,
        currency: 'KRW',
      }),
    ).toBe('싱글차지 USD 150')
  })

  it('숫자만 있으면 저장 통화와 소수 그대로 붙이고 반올림하지 않는다', () => {
    expect(singleRoomAmountLabelFromStored({ amount: 99.5, currency: 'EUR' })).toBe('EUR 99.5')
  })

  it('금액이 없으면 확인 후 안내한다', () => {
    expect(singleRoomAmountLabelFromStored(null)).toBe(SINGLE_ROOM_CONFIRM_LATER)
    expect(singleRoomAmountLabelFromStored({ amount: 0, currency: 'USD' })).toBe(SINGLE_ROOM_CONFIRM_LATER)
  })
})

describe('buildTalktalkDraft single room', () => {
  const base = {
    placeLabel: '오사카',
    weekStartYmd: '2026-12-07',
    weekFellBack: false,
    durationNote: true,
    candidates: [],
  }

  it('초안에 원문 금액을 넣고 원화로 바꾸지 않는다', () => {
    const { text } = buildTalktalkDraft({
      ...base,
      inquiryText: '오사카 1인실 추가금 알려주세요',
      singleRoomLabel: '싱글차지 USD 150',
    })
    expect(text).toContain('싱글차지 USD 150')
    expect(text).not.toMatch(/150원|KRW 150000|195,000원/)
  })

  it('상품을 특정할 수 없으면 확인 후 안내 문구만 넣는다', () => {
    const { text } = buildTalktalkDraft({
      ...base,
      inquiryText: '오사카 1인실 추가금',
      singleRoomLabel: SINGLE_ROOM_CONFIRM_LATER,
    })
    expect(text).toContain(SINGLE_ROOM_CONFIRM_LATER)
  })
})
