'use server'

import { redirect } from 'next/navigation'
import { ingestCompareClusterSupplierGaps } from '@/lib/compare-cluster-supplier-gap-ingest'
import { requireAdmin } from '@/lib/require-admin'
import { SIMILAR_ITINERARY_COMPARE_ADMIN_PATH } from '@/lib/similar-itinerary-compare-admin-path'
import { parseSimilarItineraryCompareKind } from '@/lib/similar-itinerary-compare-href'

/**
 * REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: admin 비교 페이지 → 등록대기 수집 — manifest
 */
export async function enqueueCompareClusterGapIngestAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin()
  if (!admin) {
    throw new Error('admin only')
  }

  const place = String(formData.get('place') ?? '').trim()
  const duration = String(formData.get('duration') ?? '').trim()
  // REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: 갭 수집도 kind 유지 — manifest
  const kind = parseSimilarItineraryCompareKind(String(formData.get('kind') ?? ''))
  if (!place) {
    throw new Error('place is required')
  }

  const result = await ingestCompareClusterSupplierGaps({
    place,
    duration: duration || null,
    kind,
    perSupplier: 1,
    dryRun: false,
  })

  const qs = new URLSearchParams()
  qs.set('place', place)
  if (duration) qs.set('duration', duration)
  qs.set('kind', kind)
  qs.set('gapCreated', String(result.created))
  qs.set('gapSkipped', String(result.skippedDuplicate + result.skippedNoListing.length))
  qs.set('gapFailed', String(result.failed))
  qs.set('gapTargeted', result.targeted.join(','))

  redirect(`${SIMILAR_ITINERARY_COMPARE_ADMIN_PATH}?${qs.toString()}`)
}
