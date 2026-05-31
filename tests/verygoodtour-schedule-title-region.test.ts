import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { polishVerygoodRegisterScheduleDescriptions } from '../lib/verygoodtour-schedule-description-polish'

function polishTitle(description: string, productDestination: string): string {
  return polishVerygoodRegisterScheduleDescriptions(
    [{ day: 1, title: '', description }],
    { productDestination },
  )[0]!.title
}

describe('verygood title-place region guard', () => {
  it('dest unknown(몽골, RE 미매칭) + place=로마 → keep', () => {
    assert.equal(polishTitle('로마 시내 관광', '몽골'), '로마')
  })

  it('dest=크로아티아 + place=로마 → keep', () => {
    assert.equal(polishTitle('로마 시내', '크로아티아'), '로마')
  })

  it('dest=튀니지 + place=로마 → reject', () => {
    assert.notEqual(polishTitle('로마 유적이 보존된 두가', '튀니지'), '로마')
  })

  it('dest=일본 + place=도쿄 → keep', () => {
    assert.equal(polishTitle('도쿄 시내', '일본'), '도쿄')
  })
})
