import { describe, expect, it } from 'vitest'

import {
  buildVerygoodProCodeForYmd,
  parseVerygoodProCodeDetailMetaFromHtml,
} from '@/lib/verygoodtour-procode-detail-meta'

describe('buildVerygoodProCodeForYmd', () => {
  it('replaces YYMMDD while keeping suffix', () => {
    expect(buildVerygoodProCodeForYmd('IPP105-2606243N5D', '2026-06-24')).toBe('IPP105-2606243N5D')
    expect(buildVerygoodProCodeForYmd('IPP105-2606243N5D', '2026-07-01')).toBe('IPP105-2607013N5D')
  })
})

describe('parseVerygoodProCodeDetailMetaFromHtml', () => {
  it('parses Braze productJson booking fields', () => {
    const html = `
      var productJson = {
        "product_code": "IPP105-2606243N5D",
        "airline": "제주항공",
        "minimum_booking_count": 2,
        "departure_status": "출발가능",
        "booking_status": "예약가능",
        "price": 652000
      };`
    const meta = parseVerygoodProCodeDetailMetaFromHtml('IPP105-2606243N5D', html)
    expect(meta).toMatchObject({
      proCode: 'IPP105-2606243N5D',
      statusRaw: '예약가능',
      departureStatusRaw: '출발가능',
      minPax: 2,
      carrierName: '제주항공',
      adultPrice: 652000,
    })
  })
})
