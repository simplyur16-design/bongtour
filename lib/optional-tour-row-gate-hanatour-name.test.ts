import { describe, expect, it } from 'vitest'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-hanatour'

// REGRESSION-FREEZE[optional-tour-name-display-normalize]: 하나투어 메타행·정상명 — manifest
describe('isBannedOptionalTourName (hanatour)', () => {
  it('bans fused duration/guide meta rows used as tour names', () => {
    expect(isBannedOptionalTourName('소요시간 1시간 미선택시 가이드동행 미동행')).toBe(true)
    expect(isBannedOptionalTourName('소요시간 약 60분 미선택시 가이드동행 미동행')).toBe(true)
    expect(isBannedOptionalTourName('- 소요시간: 약 3시간 (픽드랍 시간 포함)')).toBe(true)
  })

  it('keeps real tour names', () => {
    expect(isBannedOptionalTourName('바나힐 케이블카')).toBe(false)
    expect(isBannedOptionalTourName('공중전원')).toBe(false)
    expect(isBannedOptionalTourName('베트남 전통마사지 60분')).toBe(false)
    expect(isBannedOptionalTourName('BEST 1 [하나팩2.0]파타야 씨티투어')).toBe(false)
  })

  it('bans country+city location labels leaked as tour names', () => {
    expect(isBannedOptionalTourName('태국파타야')).toBe(true)
    expect(isBannedOptionalTourName('태국방콕')).toBe(true)
    expect(isBannedOptionalTourName('베트남하롱베이')).toBe(true)
    expect(isBannedOptionalTourName('캄보디아시엠립')).toBe(true)
    expect(isBannedOptionalTourName('중국소주')).toBe(true)
    expect(isBannedOptionalTourName('오스트리아잘츠부르크')).toBe(true)
    expect(isBannedOptionalTourName('체코프라하')).toBe(true)
  })
})
