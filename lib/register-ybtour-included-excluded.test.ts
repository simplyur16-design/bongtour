import { describe, expect, it } from 'vitest'
import {
  isYbtourIncExcTextBodyDump,
  overlayYbtourStructuredIncExcOnRegisterRaw,
  parseYbtourIncludedExcludedSection,
  resolveYbtourMergedIncExcText,
} from '@/lib/register-ybtour-basic'
import { resolveAirportTransferTypeForAirHotelFree } from '@/lib/airport-transfer-infer'

describe('parseYbtourIncludedExcludedSection', () => {
  it('parses circled-number and category-colon lines', () => {
    const ie = parseYbtourIncludedExcludedSection(`포함사항
① 왕복항공권, 전일정숙박비, 공항에서 호텔 픽업
교통 : 왕복항공권, 전용차량비용

불포함사항
· 개인경비
· 공항↔호텔 이동`)
    expect(ie.includedItems.length).toBeGreaterThanOrEqual(2)
    expect(ie.includedItems.some((x) => /픽업|전용차량|교통/i.test(x))).toBe(true)
    expect(ie.excludedItems.some((x) => /공항/.test(x))).toBe(true)
  })
})

describe('ybtour inc/exc body dump guard', () => {
  it('detects schedule+terms dump in excludedRaw', () => {
    const dump = `불포함사항
· 개인경비
여행 일정
1일차 인천/파리
■ 약관
■ 취소수수료`
    expect(isYbtourIncExcTextBodyDump(dump)).toBe(true)
  })

  it('prefers structured bullets over excludedRaw dump', () => {
    const dump = `불포함사항
· 개인경비
여행 일정
1일차 인천/파리`
    const merged = resolveYbtourMergedIncExcText({
      rawText: dump,
      items: [],
      structuredItems: ['개인 여행 경비(조식 제외 식비)', '호텔 시티택스(CITY TAX)'],
      fallbackText: null,
    })
    expect(merged).toContain('시티택스')
    expect(merged).not.toMatch(/1\s*일차/)
  })

  it('overlays detail-body structured excludedItems when LLM excludedRaw is dump', () => {
    const raw = overlayYbtourStructuredIncExcOnRegisterRaw(
      {
        excludedRaw: '불포함사항\n· 공항이동\n여행 일정\n1일차',
        excludedItems: [],
      },
      {
        includedItems: ['가이드비'],
        excludedItems: ['공항↔호텔 이동', '개인 여행 경비'],
      }
    )
    expect(raw.excludedItems).toEqual(['공항↔호텔 이동', '개인 여행 경비'])
    expect(raw.excludedRaw).toBeNull()
  })
})

describe('ybtour airtel airport transfer from parsed items', () => {
  it('marks pickup included when parser captured 전용차량 in included', () => {
    const ie = parseYbtourIncludedExcludedSection(`포함사항
· 교통 : 왕복항공권 (이코노미), 전용차량비용

불포함사항
· 공항↔호텔 이동
· 개인 여행경비`)
    const type = resolveAirportTransferTypeForAirHotelFree({
      includedText: ie.includedItems.join('\n'),
      excludedText: ie.excludedItems.join('\n'),
      includedItems: ie.includedItems,
      excludedItems: ie.excludedItems,
    })
    expect(type).not.toBe('NONE')
  })
})
