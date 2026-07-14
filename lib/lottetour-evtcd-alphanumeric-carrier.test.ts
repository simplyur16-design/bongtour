import { describe, expect, it } from 'vitest'
import {
  departDateFromLottetourEvtCd,
  LOTTETOUR_EVT_CD_RE,
} from '@/lib/lottetour-departures'
import { extractLottetourTripAnchorsFromPaste } from '@/lib/lottetour-trip-anchors-from-paste'
import { lottetourBuildEvtCdSyntheticDepartureInputs } from '@/lib/lottetour-synthetic-departure'

// REGRESSION-FREEZE[lottetour-evtcd-alphanumeric-carrier]: 7C 등 숫자 포함 항공사 코드 — manifest

describe('lottetour evtCd alphanumeric carrier (7C)', () => {
  it('accepts Jeju Air style evtCd and parses YYMMDD', () => {
    const evt = 'B15A2607307C000'
    expect(LOTTETOUR_EVT_CD_RE.test(evt)).toBe(true)
    expect(departDateFromLottetourEvtCd(evt)).toBe('2026-07-30')
  })

  it('still accepts letter-only carriers', () => {
    expect(LOTTETOUR_EVT_CD_RE.test('B41A260720KE019')).toBe(true)
    expect(departDateFromLottetourEvtCd('B41A260720KE019')).toBe('2026-07-20')
    expect(LOTTETOUR_EVT_CD_RE.test('B41A200821VJ002')).toBe(true)
  })

  it('trip anchors fall back to evtCd YYMMDD from evtDetail URL', () => {
    const url =
      'https://www.lottetour.com/evtDetail/826/857/2330/2343?evtCd=B15A2607307C000'
    const a = extractLottetourTripAnchorsFromPaste(url, null)
    expect(a.evtCd).toBe('B15A2607307C000')
    expect(a.tripStartIso).toBe('2026-07-30')
    expect(a.tripStartSource).toBe('evtCd_yymmdd')
  })

  it('builds synthetic departure from evtCd + adult price', () => {
    const rows = lottetourBuildEvtCdSyntheticDepartureInputs({
      evtCd: 'B15A2607307C000',
      adultPrice: 899_000,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]!.departureDate).toBe('2026-07-30')
    expect(rows[0]!.adultPrice).toBe(899_000)
    expect(rows[0]!.carrierName).toBe('7C')
    expect(rows[0]!.supplierDepartureCodeCandidate).toBe('B15A2607307C000')
  })
})
