import { describe, expect, it } from 'vitest'
import {
  missingCanonicalSuppliersFromOrigins,
  resolveCompareClusterGapIngestTargets,
} from '@/lib/dev-similar-itinerary-compare'
import { CANONICAL_OVERSEAS_SUPPLIER_KEYS } from '@/lib/overseas-supplier-canonical-keys'

describe('compare-cluster-supplier-gap-ingest', () => {
  // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: missing 차집합 — manifest
  it('missingCanonicalSuppliersFromOrigins = canonical 7 − present', () => {
    const missing = missingCanonicalSuppliersFromOrigins([
      'hanatour',
      'yellowballoon',
      '참좋은여행',
      'modetour',
    ])
    expect(missing).toEqual(
      CANONICAL_OVERSEAS_SUPPLIER_KEYS.filter(
        (k) => !['hanatour', 'ybtour', 'verygoodtour', 'modetour'].includes(k),
      ),
    )
    expect(missing).toContain('kyowontour')
    expect(missing).toContain('lottetour')
    expect(missing).toContain('naeiltour')
    expect(missing).not.toContain('hanatour')
    expect(missing).not.toContain('ybtour')
  })

  // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: 이미 있는 공급사는 ingest 대상 제외 — manifest
  it('resolveCompareClusterGapIngestTargets excludes present suppliers', () => {
    const targeted = resolveCompareClusterGapIngestTargets({
      presentOrigins: ['hanatour', 'modetour', 'ybtour', 'verygoodtour'],
      onlySuppliers: null,
    })
    expect(targeted).not.toContain('hanatour')
    expect(targeted).not.toContain('modetour')
    expect(targeted).toContain('kyowontour')
  })

  it('resolveCompareClusterGapIngestTargets respects onlySuppliers intersect missing', () => {
    const targeted = resolveCompareClusterGapIngestTargets({
      presentOrigins: ['hanatour'],
      onlySuppliers: ['hanatour', 'lottetour', 'not-a-supplier'],
    })
    expect(targeted).toEqual(['lottetour'])
  })
})
