import { describe, expect, it } from 'vitest'
import { productMatchesBrowseRegionTab } from '@/lib/browse-region-tab-match'

describe('productMatchesBrowseRegionTab', () => {
  it('matches japan tab from title when country tags are absent', () => {
    expect(
      productMatchesBrowseRegionTab(
        {
          title: '오사카 4일 자유여행',
          originSource: 'hanatour',
        },
        'japan',
      ),
    ).toBe(true)
  })

  it('excludes guam product from japan tab', () => {
    expect(
      productMatchesBrowseRegionTab(
        {
          title: '괌 5일',
          originSource: 'modetour',
        },
        'japan',
      ),
    ).toBe(false)
  })

  it('routes south-america country to south-america tab', () => {
    expect(
      productMatchesBrowseRegionTab(
        {
          title: '페루 마추픽추 8일',
          originSource: 'verygoodtour',
        },
        'south-america',
      ),
    ).toBe(true)
  })
})
