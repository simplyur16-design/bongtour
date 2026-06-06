import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isValidSeasonCurationSubtitle,
  resolveSeasonCurationSubline,
} from '../lib/season-curation-subline'

describe('season-curation-subline', () => {
  it('rejects label-style subtitles', () => {
    assert.equal(isValidSeasonCurationSubtitle('8월 도쿄 일본'), false)
    assert.equal(isValidSeasonCurationSubtitle('7월 다낭 베트남'), false)
    assert.equal(isValidSeasonCurationSubtitle('도쿄 · 일본'), false)
  })

  it('accepts one-sentence editorial subtitles', () => {
    assert.equal(isValidSeasonCurationSubtitle('가장 눈부신 보랏빛 계절을 만나다'), true)
    assert.equal(isValidSeasonCurationSubtitle('시원한 바람이 머무는 여름의 섬'), true)
  })

  it('resolveSeasonCurationSubline never returns city·country label', () => {
    const sub = resolveSeasonCurationSubline({
      targetMonth1To12: 8,
      geminiLine: '8월 도쿄 일본',
      cityLabel: '도쿄',
      countryLabel: '일본',
    })
    assert.equal(isValidSeasonCurationSubtitle(sub), true)
    assert.ok(!sub.includes(' · '))
    assert.ok(!/8월\s+도쿄\s+일본/.test(sub))
  })
})
