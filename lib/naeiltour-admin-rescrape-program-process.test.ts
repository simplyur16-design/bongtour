import { describe, expect, it } from 'vitest'
import {
  buildDetailUrl,
  calendarE2eSiteFromOrigin,
} from '@/lib/admin-departure-rescrape'

// REGRESSION-FREEZE[naeiltour-admin-rescrape-program-process]: naeiltour≠hanatour E2E — manifest

describe('naeiltour admin rescrape routing', () => {
  const detail = 'https://www.naeiltour.co.kr/sub/view.asp?good_cd=2AZZ4532'

  it('routes naeiltour.co.kr originUrl to naeiltour even when originSource is blank/hanatour-ish', () => {
    expect(calendarE2eSiteFromOrigin('', detail)).toBe('naeiltour')
    expect(calendarE2eSiteFromOrigin('hanatour', detail)).toBe('naeiltour')
    expect(calendarE2eSiteFromOrigin('하나투어', detail)).toBe('naeiltour')
  })

  it('routes normalized originSource naeiltour without URL', () => {
    expect(calendarE2eSiteFromOrigin('naeiltour', null)).toBe('naeiltour')
    expect(calendarE2eSiteFromOrigin('내일투어', null)).toBe('naeiltour')
  })

  it('does not default hanatour.com packages to naeiltour', () => {
    expect(
      calendarE2eSiteFromOrigin('hanatour', 'https://www.hanatour.com/package/detail?pkgCd=ABC'),
    ).toBe('hanatour')
  })

  it('buildDetailUrl uses view.asp?good_cd for naeiltour', () => {
    expect(buildDetailUrl('naeiltour', '2AZZ4532')).toBe(
      'https://www.naeiltour.co.kr/sub/view.asp?good_cd=2AZZ4532',
    )
  })
})
