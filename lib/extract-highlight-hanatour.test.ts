/**
 * REGRESSION-FREEZE[hanatour-register-highlight-prodinfo]: paste header + prodInfo bnft — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  extractHighlightFromHanatour,
  formatHanatourHighlightPointsFromProdInfo,
} from '@/lib/extract-highlight-hanatour'

describe('extract-highlight-hanatour', () => {
  it('extracts 📌 상품 핵심 포인트 block from paste', () => {
    const raw = `
📌 상품 핵심 포인트
② 가성비+가심비 홍콩 4성호텔 숙박
③ 홍콩 하이라이트 투어
■ 포함 내역
항공권
`
    const out = extractHighlightFromHanatour(raw)
    expect(out).toMatch(/홍콩 4성호텔/)
    expect(out).toMatch(/하이라이트 투어/)
    expect(out).not.toMatch(/포함 내역/)
  })

  it('facts-paste without header → null', () => {
    expect(extractHighlightFromHanatour('② 가성비 홍콩 4성호텔\n③ 하이라이트')).toBeNull()
  })

  // REGRESSION-FREEZE[hanatour-register-highlight-prodinfo]: bnft product highlight — manifest
  it('formatHanatourHighlightPointsFromProdInfo keeps hotel/tour selling points', () => {
    const out = formatHanatourHighlightPointsFromProdInfo({
      bnftInfoList: [
        {
          corePntTitlNm: '핵심포인트',
          corePntCont: '② 가성비+가심비 홍콩 4성호텔 숙박<br/>③ 홍콩 하이라이트 투어',
        },
        {
          corePntType: 'SAFETY',
          corePntTitlNm: '여행자 보험',
          corePntCont: '여행자보험 가입(최대 1억)',
        },
        {
          corePntTitlNm: '비자 안내',
          corePntCont: '무비자 입국 가능(90일)',
        },
        {
          corePntCont: '예약 시 확인 — 인원별 차량 배정',
        },
        {
          corePntCont: '떠나자!',
        },
      ],
    })
    expect(out).toMatch(/4성호텔/)
    expect(out).toMatch(/하이라이트/)
    expect(out).not.toMatch(/보험/)
    expect(out).not.toMatch(/비자/)
    expect(out).not.toMatch(/인원별 차량/)
    expect(out).not.toMatch(/떠나자/)
  })

  it('prefers bnftInfoList over rppdCntntInfoList', () => {
    const out = formatHanatourHighlightPointsFromProdInfo({
      bnftInfoList: [{ corePntCont: '세부 호핑투어 포함' }],
      rppdCntntInfoList: [{ corePntCont: '다른 문구 무시' }],
    })
    expect(out).toBe('세부 호핑투어 포함')
  })
})
