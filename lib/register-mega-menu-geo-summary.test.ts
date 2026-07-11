/**
 * REGRESSION-FREEZE[mega-menu-product-alignment]
 * REGRESSION-FREEZE[register-mega-menu-auto-classify]
 */
import { describe, expect, it } from 'vitest'
import {
  buildRegisterMegaMenuGeoSummary,
  inferMegaMenuSubgroupFromRegisterTags,
  megaMenuSummaryNeedsOperatorReview,
} from '@/lib/register-mega-menu-geo-summary'

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

  it('infers 동유럽 from multi-country tags (오스트리아·체코·헝가리)', () => {
    const label = inferMegaMenuSubgroupFromRegisterTags('europe-me', ['austria', 'czech', 'hungary'], [])
    expect(label).toBe('동유럽')
  })

  it('does not require subgroupLabel for registered when country tags exist', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'austria',
        cityKey: null,
        nodeKey: null,
        groupKey: 'europe',
        continent: null,
        continentKey: null,
        country: null,
        city: null,
        locationMatchConfidence: null,
        locationMatchSource: null,
      },
      cityKeys: [],
      countryTagKeys: ['austria', 'czech', 'hungary'],
      tagOpts: {
        title: '오스트리아·체코·헝가리 8일',
        primaryDestination: '비엔나',
        destinationRaw: '오스트리아·체코·헝가리',
        scheduleHaystack: '비엔나 프라하 부다페스트',
      },
    })
    expect(summary.browseRegionTab).toBe('europe-me')
    expect(summary.subgroupLabel).toBe('동유럽')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, {
        countryTagKeys: ['austria', 'czech', 'hungary'],
      }),
    ).toBe(false)
  })

  it('infers japan kansai from osaka city tag', () => {
    const label = inferMegaMenuSubgroupFromRegisterTags('japan', ['japan'], ['osaka'])
    expect(label).toBe('간사이')
  })

  it('infers china country from qingdao city tag when geo.countryKey missing', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: null,
        cityKey: 'qingdao',
        nodeKey: 'qingdao',
        groupKey: 'china-hk-mo',
        continent: null,
        continentKey: null,
        country: null,
        city: null,
        locationMatchConfidence: null,
        locationMatchSource: null,
      },
      cityKeys: ['qingdao', 'yantai'],
      countryKeyOverride: 'china',
      tagOpts: {
        title: '',
        primaryDestination: null,
        destinationRaw: null,
        scheduleHaystack: '칭다오 - 잔교 - 빈해광장',
      },
    })
    expect(summary.countryKey).toBe('china')
    expect(summary.browseRegionTab).toBe('china-hk-mo')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, {
        countryTagKeys: [],
      }),
    ).toBe(false)
  })

  it('infers 몽골 from mongolia country tag (city-only mega menu group)', () => {
    const label = inferMegaMenuSubgroupFromRegisterTags('china-hk-mo', ['mongolia'], [])
    expect(label).toBe('몽골')
  })
})
