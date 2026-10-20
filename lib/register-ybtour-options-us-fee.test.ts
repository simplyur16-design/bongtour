import { describe, expect, it } from 'vitest'
import { parseYbtourOptionalTourPasteSection } from './register-ybtour-options'

describe('parseYbtourOptionalTourPasteSection US$ fee anchors', () => {
  it('parses 비용US$30 / 비용+US$30 blocks into real tour names', () => {
    const paste = `
럭셔리 전동카
비용US$30
더보기

럭셔리 전동카를 타고 미케비치를 따라 드라이브

비용
US$30
소요시간
약 1시간
참고사항
▶옵션 미 참여자
대기장소 : 호텔로 이동 및 근처 대기
바나산 테마파크
비용US$70
더보기

바나산 케이블카

비용
US$70
소요시간
약 3시간
참고사항
▶옵션 미 참여자
대기장소 : 바나산 입구
`.trim()

    const parsed = parseYbtourOptionalTourPasteSection(paste)
    const names = parsed.rows.map((r) => r.tourName)
    expect(names).toEqual(['럭셔리 전동카', '바나산 테마파크'])
    expect(parsed.rows.map((r) => r.adultPrice)).toEqual([30, 70])
    expect(names.some((n) => /비용US|^US$|약\s*\d+시간/i.test(n))).toBe(false)
  })

  it('parses 비용CAD $85/인 blocks into real tour names', () => {
    const paste = `
캐필라노 서스펜션 브릿지
비용CAD $85/인
더보기

비용
CAD $85/인
참고사항
노스밴쿠버 흔들다리
설상차
비용CAD $100/인
더보기

비용
CAD $100/인
소요시간
약 1시간~1시간 반
헬기투어
비용CAD $240
더보기

비용
CAD $240
소요시간
약 15~30분
참고사항
로키산맥의 빙하
벤프 곤돌라
비용CAD $145/인
더보기

비용
CAD $145/인
참고사항
곤돌라 타고 밴프 감상
`.trim()

    const parsed = parseYbtourOptionalTourPasteSection(paste)
    const names = parsed.rows.map((r) => r.tourName)
    expect(names).toEqual(['캐필라노 서스펜션 브릿지', '설상차', '헬기투어', '벤프 곤돌라'])
    expect(parsed.rows.map((r) => r.adultPrice)).toEqual([85, 100, 240, 145])
    expect(names.some((n) => /비용CAD|^CAD$|약\s*\d/i.test(n))).toBe(false)
  })
})
