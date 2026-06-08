import { describe, expect, it } from 'vitest'
import { buildRegisterMegaMenuGeoSummary } from '@/lib/register-mega-menu-geo-summary'

describe('buildRegisterMegaMenuGeoSummary', () => {
  it('resolves japan osaka subgroup', () => {
    const s = buildRegisterMegaMenuGeoSummary({
      geo: { countryKey: 'japan', cityKey: 'osaka', nodeKey: 'osaka', groupKey: 'japan' },
      cityKeys: ['osaka'],
      tagOpts: { title: '오사카 4일', primaryDestination: '오사카', destinationRaw: null },
    })
    expect(s.browseRegionTab).toBe('japan')
    expect(s.subgroupLabel).toBeTruthy()
    expect(s.warnings).toHaveLength(0)
  })

  it('warns when city tags are empty', () => {
    const s = buildRegisterMegaMenuGeoSummary({
      geo: { countryKey: 'china', cityKey: null, nodeKey: null, groupKey: 'china-circle' },
      cityKeys: [],
      tagOpts: { title: '중국 5일', primaryDestination: '중국', destinationRaw: null },
    })
    expect(s.warnings.some((w) => w.includes('ProductCityTag'))).toBe(true)
  })
})
