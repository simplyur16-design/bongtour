'use server'

import { redirect } from 'next/navigation'
import { assertDevDesignPreviewAllowed } from '@/lib/dev-design-preview-guard'
import { ingestCompareClusterSupplierGaps } from '@/lib/compare-cluster-supplier-gap-ingest'
import { SIMILAR_ITINERARY_COMPARE_PATH } from '@/lib/similar-itinerary-compare-href'

/**
 * REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: 비교 페이지 → 등록대기 수집 — manifest
 */
export async function enqueueCompareClusterGapIngestAction(formData: FormData): Promise<void> {
  assertDevDesignPreviewAllowed()

  const place = String(formData.get('place') ?? '').trim()
  const duration = String(formData.get('duration') ?? '').trim()
  if (!place) {
    throw new Error('place is required')
  }

  const result = await ingestCompareClusterSupplierGaps({
    place,
    duration: duration || null,
    perSupplier: 1,
    dryRun: false,
  })

  const qs = new URLSearchParams()
  qs.set('place', place)
  if (duration) qs.set('duration', duration)
  qs.set('gapCreated', String(result.created))
  qs.set('gapSkipped', String(result.skippedDuplicate + result.skippedNoListing.length))
  qs.set('gapFailed', String(result.failed))
  qs.set('gapTargeted', result.targeted.join(','))

  redirect(`${SIMILAR_ITINERARY_COMPARE_PATH}?${qs.toString()}`)
}
