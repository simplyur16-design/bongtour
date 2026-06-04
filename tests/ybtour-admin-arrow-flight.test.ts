import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseYbtourFlightInput } from '../lib/register-input-parse-ybtour'

describe('ybtour admin arrow flight paste', () => {
  it('parses 관리자 placeholder 형식 (출발편/귀국편 + →)', () => {
    const paste = [
      '항공사: 제주항공',
      '— 출발편 —',
      '7C1351 | 김포 2026-10-01 08:00 → 제주 2026-10-01 09:10',
      '— 귀국편 —',
      '7C1352 | 제주 2026-10-05 19:00 → 김포 2026-10-05 20:10',
    ].join('\n')
    const r = parseYbtourFlightInput(paste, null)
    assert.equal(r.outbound?.flightNo, '7C1351')
    assert.equal(r.inbound?.flightNo, '7C1352')
    assert.equal(r.airlineName, '제주항공')
    assert.equal(r.debug?.status, 'success')
    assert.equal(r.debug?.exposurePolicy, 'public_full')
  })
})
