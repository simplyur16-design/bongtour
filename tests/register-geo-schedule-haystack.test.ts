import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildRegisterGeoHaystackFromSchedule } from '../lib/register-geo-schedule-haystack'

describe('buildRegisterGeoHaystackFromSchedule', () => {
  it('title·description·routeText를 합친다', () => {
    const h = buildRegisterGeoHaystackFromSchedule([
      { title: '1일차', description: '카이로', routeText: '인천 - 카이로 - 룩소르' },
      { title: '2일차', routeText: '룩소르 - 아부심벨' },
    ])
    assert.ok(h?.includes('카이로'))
    assert.ok(h?.includes('룩소르'))
    assert.ok(h?.includes('아부심벨'))
  })
})
