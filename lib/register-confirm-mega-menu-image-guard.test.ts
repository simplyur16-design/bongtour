/**
 * 등록 confirm — 메가메뉴 자동 분류 + imageKeyword SSOT 회귀 가드.
 * REGRESSION-FREEZE[register-confirm-mega-menu-image-guard]: manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import {
  buildRegisterMegaMenuGeoSummary,
  inferMegaMenuSubgroupFromRegisterTags,
  megaMenuSummaryNeedsOperatorReview,
} from '@/lib/register-mega-menu-geo-summary'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

const emptyGeoFields = {
  groupKey: null,
  continent: null,
  continentKey: null,
  country: null,
  city: null,
  locationMatchConfidence: null,
  locationMatchSource: null,
}

describe('register confirm mega menu guard', () => {
  it('japan osaka — 간사이 + city tag면 pending 불요', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'japan',
        cityKey: 'osaka',
        nodeKey: 'osaka',
        ...emptyGeoFields,
      },
      cityKeys: ['osaka'],
      countryTagKeys: ['japan'],
      tagOpts: {
        title: '오사카 4일',
        primaryDestination: '오사카',
        destinationRaw: '오사카',
        scheduleHaystack: '오사카 도톤보리',
      },
    })
    expect(summary.browseRegionTab).toBe('japan')
    expect(summary.subgroupLabel).toBe('간사이')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, { countryTagKeys: ['japan'] }),
    ).toBe(false)
  })

  it('china beijing — china-hk-mo + city tag', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'china',
        cityKey: 'beijing',
        nodeKey: 'beijing',
        ...emptyGeoFields,
      },
      cityKeys: ['beijing'],
      countryTagKeys: ['china'],
      tagOpts: {
        title: '북경 5일',
        primaryDestination: '북경',
        destinationRaw: '중국',
        scheduleHaystack: '만리장성',
      },
    })
    expect(summary.browseRegionTab).toBe('china-hk-mo')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, { countryTagKeys: ['china'] }),
    ).toBe(false)
  })

  it('mongolia — china-hk-mo 몽골 열 + country tag', () => {
    const label = inferMegaMenuSubgroupFromRegisterTags('china-hk-mo', ['mongolia'], [])
    expect(label).toBe('몽골')
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'mongolia',
        cityKey: null,
        nodeKey: null,
        ...emptyGeoFields,
      },
      cityKeys: [],
      countryTagKeys: ['mongolia'],
      tagOpts: {
        title: '몽골 테렐지 4일',
        primaryDestination: '울란바토르',
        destinationRaw: '몽골',
        scheduleHaystack: '테렐지 국립공원',
      },
    })
    expect(summary.browseRegionTab).toBe('china-hk-mo')
    expect(
      megaMenuSummaryNeedsOperatorReview(summary, { countryTagKeys: ['mongolia'] }),
    ).toBe(false)
  })

  it('europe 3-country — 동유럽 + multi country tags', () => {
    const summary = buildRegisterMegaMenuGeoSummary({
      geo: {
        countryKey: 'austria',
        cityKey: null,
        nodeKey: null,
        groupKey: 'europe',
        ...emptyGeoFields,
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
})

describe('register confirm imageKeyword guard', () => {
  it('modetour danang — routeText 2-slot + apply/preview parity', () => {
    const rows = [
      { day: 1, routeText: '인천 - Da Nang', imageKeyword: '', imageKeyword2: null },
      { day: 2, routeText: 'Da Nang - Hoi An', imageKeyword: '', imageKeyword2: null },
      { day: 3, routeText: 'Hoi An - Da Nang', imageKeyword: '', imageKeyword2: null },
      { day: 4, routeText: 'Da Nang - Incheon', imageKeyword: '', imageKeyword2: null },
    ]
    const opts = {
      supplierKey: 'modetour',
      productDestination: '다낭',
      productTitle: '다낭 4일',
    }
    const viaApply = applyRegisterScheduleImageKeywordsBySupplier(rows, opts)
    const viaPreview = applyRegisterScheduleImageKeywordsForPreview(rows, opts)
    const mid = viaApply.find((r) => r.day === 2)!
    expect(String(mid.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(String(mid.imageKeyword2 ?? '').trim().length).toBeGreaterThan(0)
    expect(mid.imageKeyword).not.toBe(mid.imageKeyword2)
    for (const row of viaApply) {
      const other = viaPreview.find((r) => r.day === row.day)
      expect(other?.imageKeyword).toBe(row.imageKeyword)
      expect(other?.imageKeyword2).toBe(row.imageKeyword2)
    }
  })

  it('hanatour post-augment — middle day keywords unique', async () => {
    const parsed = {
      schedule: [
        { day: 1, routeText: '인천 - 오사카', imageKeyword: '', imageKeyword2: null },
        { day: 2, routeText: '오사카 - 교토 - 오사카', imageKeyword: '', imageKeyword2: null },
        { day: 3, routeText: '오사카 - 인천', imageKeyword: '', imageKeyword2: null },
      ],
      primaryDestination: '오사카',
      destination: '오사카',
      title: '오사카 3일',
    }
    const after = await applyRegisterPostAugmentSchedulePipeline(parsed, {
      forcedBrandKey: 'hanatour',
      travelScope: 'package',
      mode: 'confirm',
    })
    const used = new Set<string>()
    for (const row of after.schedule ?? []) {
      for (const slot of [row.imageKeyword, row.imageKeyword2]) {
        const kw = String(slot ?? '').trim()
        if (!kw) continue
        const nk = normScheduleImageKeywordKey(kw)
        expect(used.has(nk)).toBe(false)
        used.add(nk)
      }
    }
    const mid = (after.schedule ?? []).find((r) => r.day === 2)
    expect(String(mid?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
  })
})
