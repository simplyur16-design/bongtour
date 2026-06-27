/**
 * REGRESSION-FREEZE[mega-menu-product-alignment]
 */
import { describe, expect, it } from 'vitest'
import { buildRegisterMegaMenuGeoSummary } from '@/lib/register-mega-menu-geo-summary'

describe('register mega menu geo summary', () => {
  it('prefers cityKey placement over schedule noise (푸꾸옥 + 베네치아 언급)', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'vietnam',
        cityKey: 'phuquoc',
        nodeKey: 'phuquoc',
        groupKey: 'sea-taiwan-south-asia',
        continent: null,
        continentKey: null,
        country: null,
        city: null,
        locationMatchConfidence: null,
        locationMatchSource: null,
      },
      cityKeys: ['phuquoc'],
      tagOpts: {
        title: '푸꾸옥 자유여행 3박5일',
        primaryDestination: '푸꾸옥',
        destinationRaw: '푸꾸옥',
        scheduleHaystack: '푸꾸옥 이탈리아 베네치아를 닮은 그랜드월드',
      },
    })
    expect(summary.browseRegionTab).toBe('southeast-asia')
    expect(summary.subgroupLabel).toBe('베트남')
    expect(summary.warnings.join(' ')).not.toMatch(/europe-me/)
  })
})
