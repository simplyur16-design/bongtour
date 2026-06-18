import { config } from 'dotenv'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'

config({ path: path.resolve(process.cwd(), '.env.local') })

const hasDb = Boolean(process.env.DATABASE_URL?.trim())

import {
  ALL_BATCH_PARITY_FIXTURE_KEYS,
  BATCH_PARITY_FIXTURE_GROUPS,
  JAPAN_MENU_GROUP_CITY_KEY,
  PRODUCTION_SEASON_POOL_13_CITY_KEYS,
  UNKNOWN_CITY_KEY,
} from '@/lib/mega-menu-city-browse-href.batch-parity.fixtures'
import type { BrowseUrlGeo } from '@/lib/match-overseas-product'

type MegaMenuHrefModule = typeof import('@/lib/mega-menu-city-browse-href')

let megaMenuHref: MegaMenuHrefModule

async function singleGeoMap(cityKeys: readonly string[]): Promise<Map<string, BrowseUrlGeo>> {
  const out = new Map<string, BrowseUrlGeo>()
  for (const ck of cityKeys) {
    const geo = await megaMenuHref.buildBrowseUrlGeoForMegaMenuCityKey(ck)
    if (geo) out.set(ck, geo)
  }
  return out
}

describe.skipIf(!hasDb)('mega-menu-city-browse-href batch parity (integration)', () => {
  beforeAll(async () => {
    megaMenuHref = await import('@/lib/mega-menu-city-browse-href')
    megaMenuHref.resetMegaMenuCityBrowseHrefCache()
  })

  for (const group of BATCH_PARITY_FIXTURE_GROUPS) {
    it(`batch matches per-city for: ${group.label}`, async () => {
      const batch = await megaMenuHref.loadMegaMenuBrowseUrlGeoByCityKeysBatch([...group.keys])
      const single = await singleGeoMap(group.keys)
      expect(batch).toEqual(single)
    })
  }

  it('production season pool 13 keys — full map parity', async () => {
    const keys = [...PRODUCTION_SEASON_POOL_13_CITY_KEYS]
    const batch = await megaMenuHref.loadMegaMenuBrowseUrlGeoByCityKeys(keys)
    const single = await singleGeoMap(keys)
    expect(batch).toEqual(single)
    expect(batch.size).toBeGreaterThan(0)
  })

  it('unknown cityKey omitted from map', async () => {
    const batch = await megaMenuHref.loadMegaMenuBrowseUrlGeoByCityKeysBatch([UNKNOWN_CITY_KEY])
    const single = await megaMenuHref.buildBrowseUrlGeoForMegaMenuCityKey(UNKNOWN_CITY_KEY)
    expect(single).toBeNull()
    expect(batch.has(UNKNOWN_CITY_KEY)).toBe(false)
  })

  it('japan menuGroup leaf href includes menuGroup param', async () => {
    const href = await megaMenuHref.resolveMegaMenuBrowseHrefForCityKey(JAPAN_MENU_GROUP_CITY_KEY)
    expect(href).toBeTruthy()
    expect(href).toContain('menuGroup=')
  })

  it('all fixture keys combined — batch vs single toEqual', async () => {
    const keys = [...ALL_BATCH_PARITY_FIXTURE_KEYS]
    const batch = await megaMenuHref.loadMegaMenuBrowseUrlGeoByCityKeysBatch(keys)
    const single = await singleGeoMap(keys)
    expect(batch).toEqual(single)
  })
})
