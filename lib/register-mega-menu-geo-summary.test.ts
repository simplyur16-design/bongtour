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

  it('latin-caribbean geo without tree match → south-america tab', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'latin-caribbean',
        cityKey: null,
        nodeKey: 'south-america',
        groupKey: 'americas',
        continent: null,
        continentKey: null,
        country: null,
        city: null,
        locationMatchConfidence: null,
        locationMatchSource: null,
      },
      cityKeys: [],
      countryTagKeys: ['peru', 'bolivia', 'brazil', 'argentina'],
      tagOpts: {
        title: '남미 12일 #4개국 #우유니 별빛투어 #이과수 헬기투어',
        primaryDestination: '미지정',
        destinationRaw: '미지정',
        scheduleHaystack: '리마 쿠스코 라파즈 우유니 리오데자네이로 이과수',
      },
    })
    expect(summary.browseRegionTab).toBe('south-america')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, {
        countryTagKeys: ['peru', 'bolivia', 'brazil', 'argentina'],
      }),
    ).toBe(false)
  })

  it('central-asia geo → europe-me tab (not china-hk-mo)', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'central-asia',
        cityKey: null,
        nodeKey: null,
        groupKey: 'china-circle',
        continent: null,
        continentKey: null,
        country: null,
        city: null,
        locationMatchConfidence: null,
        locationMatchSource: null,
      },
      cityKeys: [],
      countryTagKeys: ['uzbekistan', 'kazakhstan', 'kyrgyzstan'],
      tagOpts: {
        title: '중앙아시아 3국 7박9일 우즈베키스탄/카자흐스탄/키르기스스탄 #노쇼핑노옵션',
        primaryDestination: '노쇼핑노옵션',
        destinationRaw: '노쇼핑노옵션',
        scheduleHaystack: '타슈켄트 사마르칸트 알마티',
      },
    })
    expect(summary.browseRegionTab).toBe('europe-me')
    expect(summary.subgroupLabel).toBe('중앙아시아')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, {
        countryTagKeys: ['uzbekistan', 'kazakhstan', 'kyrgyzstan'],
      }),
    ).toBe(false)
  })

  it('infers 중앙아시아 from uzbekistan country tags', () => {
    const label = inferMegaMenuSubgroupFromRegisterTags(
      'europe-me',
      ['uzbekistan', 'kazakhstan', 'kyrgyzstan'],
      [],
    )
    expect(label).toBe('중앙아시아')
  })
})
