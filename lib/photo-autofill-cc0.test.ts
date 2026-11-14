import { describe, expect, it } from 'vitest'
import { commonsPagesToCandidates, isNoAttributionCommonsLicense } from '@/lib/photo-autofill-cc0'

describe('photo-autofill-cc0: 표기 없는 라이선스만', () => {
  it('CC0·퍼블릭 도메인만 허용하고 CC BY 는 버린다', () => {
    expect(isNoAttributionCommonsLicense('CC0')).toBe(true)
    expect(isNoAttributionCommonsLicense('CC0 1.0')).toBe(true)
    expect(isNoAttributionCommonsLicense('Public domain')).toBe(true)
    expect(isNoAttributionCommonsLicense('Public Domain Mark')).toBe(true)
    expect(isNoAttributionCommonsLicense('PDM')).toBe(true)
    expect(isNoAttributionCommonsLicense('CC BY 4.0')).toBe(false)
    expect(isNoAttributionCommonsLicense('CC BY-SA 4.0')).toBe(false)
    expect(isNoAttributionCommonsLicense('GFDL')).toBe(false)
    expect(isNoAttributionCommonsLicense('')).toBe(false)
  })

  it('검색 결과에서 CC BY·SVG 는 빼고 CC0 만 후보로 만든다', () => {
    const cands = commonsPagesToCandidates({
      query: {
        pages: {
          '1': {
            pageid: 1,
            title: 'File:Blue Mosque Istanbul.jpg',
            imageinfo: [{ url: 'https://upload.wikimedia.org/a.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Blue_Mosque_Istanbul.jpg', width: 2000, height: 1200, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC0' }, Artist: { value: '<a>Ada</a>' }, ImageDescription: { value: 'Blue Mosque in Istanbul' } } }],
          },
          '2': {
            pageid: 2,
            title: 'File:Other.jpg',
            imageinfo: [{ url: 'https://upload.wikimedia.org/b.jpg', width: 2000, height: 1200, mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' } } }],
          },
          '3': {
            pageid: 3,
            title: 'File:Map.svg',
            imageinfo: [{ url: 'https://upload.wikimedia.org/c.svg', width: 2000, height: 1200, mime: 'image/svg+xml', extmetadata: { LicenseShortName: { value: 'CC0' } } }],
          },
        },
      },
    })
    expect(cands).toHaveLength(1)
    expect(cands[0]).toMatchObject({ id: '1', source: 'CC0', photographer: 'Ada', width: 2000 })
    expect(cands[0]!.altText).toContain('Blue Mosque')
  })
})
