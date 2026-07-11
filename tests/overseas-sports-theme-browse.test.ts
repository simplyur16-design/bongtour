import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { computeHubFocusedResults } from '../lib/hub-focused-results'
import { resolveOverseasGeoFilterBanner } from '../lib/overseas-destination-browse'

describe('overseas sports theme browse', () => {
  it('resolveOverseasGeoFilterBanner — region=sports_theme', async () => {
    const banner = await resolveOverseasGeoFilterBanner({ region: 'sports_theme' })
    assert.equal(banner?.title, '테마여행 여행상품')
  })

  it('resolveOverseasGeoFilterBanner — sportsTheme=running', async () => {
    const banner = await resolveOverseasGeoFilterBanner({
      region: 'sports_theme',
      sportsTheme: 'running',
    })
    assert.equal(banner?.title, '러닝 여행상품')
  })

  it('resolveOverseasGeoFilterBanner — sportsTheme=mingling', async () => {
    const banner = await resolveOverseasGeoFilterBanner({
      region: 'sports_theme',
      sportsTheme: 'mingling',
    })
    assert.equal(banner?.title, '밍글밍 여행상품')
  })

  it('computeHubFocusedResults — sports_theme region is focused', () => {
    const sp = new URLSearchParams('scope=overseas&region=sports_theme')
    assert.equal(
      computeHubFocusedResults({
        pathname: '/travel/overseas',
        defaultScope: 'overseas',
        searchParams: sp,
      }),
      true,
    )
  })

  it('computeHubFocusedResults — sportsTheme alone is focused', () => {
    const sp = new URLSearchParams('scope=overseas&region=sports_theme&sportsTheme=golf')
    assert.equal(
      computeHubFocusedResults({
        pathname: '/travel/overseas',
        defaultScope: 'overseas',
        searchParams: sp,
      }),
      true,
    )
  })
})
