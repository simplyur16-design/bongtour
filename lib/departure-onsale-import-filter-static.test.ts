import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** REGRESSION-FREEZE[departure-onsale-import-filter]: every upsert wires on-sale filter — manifest */
const UPSERT_FILES = [
  'lib/upsert-product-departures-hanatour.ts',
  'lib/upsert-product-departures-modetour.ts',
  'lib/upsert-product-departures-ybtour.ts',
  'lib/upsert-product-departures-kyowontour.ts',
  'lib/upsert-product-departures-lottetour.ts',
  'lib/upsert-product-departures-naeiltour.ts',
  'lib/upsert-product-departures-verygoodtour.ts',
] as const

const COLLECT_FILES = [
  'lib/hanatour-api-departures.ts',
  'lib/modetour-departures.ts',
  'lib/ybtour-api-departures.ts',
  'lib/kyowontour-departures.ts',
  'lib/lottetour-departures.ts',
  'lib/naeiltour-departures.ts',
  'lib/verygoodtour-calendar-hxr.ts',
  'lib/apply-product-calendar-price-items.ts',
] as const

describe('departure-onsale-import-filter static', () => {
  it('all supplier upsert modules call filterDeparturesOnSaleForImport', () => {
    for (const rel of UPSERT_FILES) {
      const src = readFileSync(path.join(process.cwd(), rel), 'utf8')
      expect(src, rel).toContain('filterDeparturesOnSaleForImport')
      expect(src, rel).toContain('REGRESSION-FREEZE[departure-onsale-import-filter]')
    }
  })

  it('collect/parse paths call isDepartureOnSaleForImport', () => {
    for (const rel of COLLECT_FILES) {
      const src = readFileSync(path.join(process.cwd(), rel), 'utf8')
      expect(src, rel).toContain('isDepartureOnSaleForImport')
    }
  })
})
