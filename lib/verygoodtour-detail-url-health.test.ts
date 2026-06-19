import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  isVerygoodtourDetailUrlExpired,
  normalizeVerygoodtourDetailUrlForCollect,
  verygoodtourDetailHtmlLooksExpired,
} from '@/lib/verygoodtour-detail-url-health'

describe('normalizeVerygoodtourDetailUrlForCollect', () => {
  it('strips MenuCode=leaveLayer', () => {
    expect(
      normalizeVerygoodtourDetailUrlForCollect(
        'https://www.verygoodtour.com/Product/PackageDetail?ProCode=EPP0113-260424SK&PriceSeq=1&MenuCode=leaveLayer',
      ),
    ).toBe('https://www.verygoodtour.com/Product/PackageDetail?ProCode=EPP0113-260424SK&PriceSeq=1')
  })
})

describe('verygoodtourDetailHtmlLooksExpired', () => {
  it('detects sold-out alert script', () => {
    expect(verygoodtourDetailHtmlLooksExpired("alert('등록되지 않은 상품이거나 이미 판매가 종료된 상품입니다');history.back();")).toBe(
      true,
    )
  })

  it('live package page is not expired', () => {
    expect(verygoodtourDetailHtmlLooksExpired('<html><h3 class="package-title">홍콩 4일</h3></html>')).toBe(false)
  })
})

describe('isVerygoodtourDetailUrlExpired', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('GET fallback when HEAD redirects to 404 but body is live', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input)
        if (init?.method === 'HEAD') {
          return new Response(null, {
            status: 302,
            headers: { location: '/Content/ErrorPage/404.html' },
          })
        }
        return new Response('<html><meta property="og:title" content="live product" /></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      }),
    )

    const expired = await isVerygoodtourDetailUrlExpired(
      'https://www.verygoodtour.com/Product/PackageDetail?ProCode=EPP0113-260424SK&PriceSeq=1',
    )
    expect(expired).toBe(false)
  })
})
