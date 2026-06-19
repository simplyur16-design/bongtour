import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildModetourPackageUrlFromOriginCode,
  extractModetourProductNoFromPackageUrl,
  resolveModetourDetailByOriginCode,
} from '@/lib/modetour-origin-code-resolve'

describe('buildModetourPackageUrlFromOriginCode', () => {
  it('uses /package/{originCode} not pkgCd query', () => {
    expect(buildModetourPackageUrlFromOriginCode('QJP601RFR3')).toBe(
      'https://www.modetour.com/package/QJP601RFR3',
    )
    expect(buildModetourPackageUrlFromOriginCode('QJP601RFR3')).not.toContain('pkgCd=')
  })
})

describe('extractModetourProductNoFromPackageUrl', () => {
  it('parses numeric package path', () => {
    expect(extractModetourProductNoFromPackageUrl('https://www.modetour.com/package/107583036')).toBe(
      '107583036',
    )
    expect(extractModetourProductNoFromPackageUrl('https://www.modetour.com/package/0')).toBeNull()
  })
})

describe('resolveModetourDetailByOriginCode', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    global.fetch = vi.fn() as typeof fetch
  })

  it('follows redirect from origin code to current productNo', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      status: 302,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'location' ? '/package/107583036' : null,
      },
    } as Response)

    const out = await resolveModetourDetailByOriginCode('QJP601RFR3')

    expect(out.source).toBe('origin-code-redirect')
    expect(out.productNo).toBe('107583036')
    expect(out.detailUrl).toBe('https://www.modetour.com/package/107583036')
    expect(global.fetch).toHaveBeenCalledWith(
      'https://www.modetour.com/package/QJP601RFR3',
      expect.objectContaining({ redirect: 'manual' }),
    )
  })

  it('falls back to stored originUrl when redirect fails', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('network'))

    const out = await resolveModetourDetailByOriginCode('QJP601RFR3', {
      storedOriginUrl: 'https://www.modetour.com/package/107583021',
    })

    expect(out.source).toBe('stored-origin-url')
    expect(out.productNo).toBe('107583021')
  })
})
