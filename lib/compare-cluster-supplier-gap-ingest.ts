/**
 * 비슷한 일정 비교 클러스터에서 모자란 canonical 공급사만
 * 목적지 키워드(searchWord=place)로 목록 수집 → 등록대기(pending).
 * 야간 listing-ingest 쿼타/지오 슬롯 SSOT는 건드리지 않는다.
 * REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: forced searchWord · pending confirm — manifest
 */

import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { extractRegisterProductDedupeKeys } from '@/lib/register-product-duplicate-guard'
import {
  loadSimilarItineraryCompare,
  resolveCompareClusterGapIngestTargets,
} from '@/lib/dev-similar-itinerary-compare'
import {
  parseSimilarItineraryCompareKind,
  type SimilarItineraryCompareKind,
} from '@/lib/similar-itinerary-compare-href'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import {
  ingestSupplierBrowseHome,
  isRegisterPrePhotoIngestSupplier,
  pickUnknownListingUrlsUntilQuota,
  type RegisterPrePhotoIngestGeoSlot,
  type RegisterPrePhotoIngestSupplier,
} from '@/lib/register-pre-photo-ingest-geo-slots'
import { confirmRegisterPendingFromOriginUrl } from '@/lib/register-pre-photo-ingest-confirm'
import { markProductCompareClusterGapPriority } from '@/lib/register-compare-cluster-gap-priority'
import {
  ingestSlotLabel,
  listingUrlMapForSupplier,
  registerPrePhotoListingUrlIsKnown,
  waitListingHumanPause,
} from '@/lib/register-pre-photo-listing-ingest'

export type CompareClusterGapIngestOpts = {
  place: string
  /** 박일 — 갭 재계산(등록 클러스터)에만 쓰며 목록 API에는 강제하지 않음 */
  duration?: string | null
  /** REGRESSION-FREEZE[similar-itinerary-compare-kind-split]: 갭도 package|fit 분리 — manifest */
  kind?: SimilarItineraryCompareKind | string | null
  onlySuppliers?: string[] | null
  /** 공급사당 신규 pending 상한 (기본 1) */
  perSupplier?: number
  dryRun?: boolean
}

export type CompareClusterGapIngestResult = {
  place: string
  duration: string | null
  missingSuppliers: CanonicalOverseasSupplierKey[]
  targeted: CanonicalOverseasSupplierKey[]
  created: number
  skippedDuplicate: number
  skippedNoListing: string[]
  failed: number
  dryRun: boolean
  bySupplier: Record<string, { created: number; skipped: number; failed: number; reasons: string[] }>
}

export { resolveCompareClusterGapIngestTargets }

function forcedPlaceSlot(
  supplier: RegisterPrePhotoIngestSupplier,
  place: string,
): RegisterPrePhotoIngestGeoSlot {
  // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: forced searchWord = place — manifest
  return {
    supplier,
    lane: 'package',
    countryKey: '_compare_gap',
    cityKey: null,
    originUrl: ingestSupplierBrowseHome(supplier),
    destination: place,
    searchWord: place,
    pending: 0,
  }
}

async function loadKnownDedupeKeys(): Promise<Set<string>> {
  const products = await prisma.product.findMany({
    where: {
      originSource: {
        in: [
          'hanatour',
          'modetour',
          'ybtour',
          'verygoodtour',
          'kyowontour',
          'lottetour',
          'naeiltour',
          'yellowballoon',
        ],
      },
    },
    select: { originSource: true, originCode: true, originUrl: true },
  })
  const knownKeys = new Set<string>()
  for (const p of products) {
    const supplier = normalizeSupplierOrigin(p.originSource)
    if (!supplier || !isRegisterPrePhotoIngestSupplier(supplier)) continue
    for (const k of extractRegisterProductDedupeKeys(supplier, p.originUrl)) {
      knownKeys.add(`${k.kind}:${k.value}`)
    }
    const code = String(p.originCode ?? '').trim()
    if (code) knownKeys.add(`originCode:${supplier}:${code}`)
  }
  return knownKeys
}

export async function ingestCompareClusterSupplierGaps(
  opts: CompareClusterGapIngestOpts,
): Promise<CompareClusterGapIngestResult> {
  const place = String(opts.place || '').trim()
  if (!place) {
    throw new Error('place is required')
  }
  const duration = opts.duration != null ? String(opts.duration).trim() || null : null
  const dryRun = opts.dryRun === true
  const perSupplier =
    Number.isFinite(opts.perSupplier) && (opts.perSupplier as number) >= 1
      ? Math.min(5, Math.floor(opts.perSupplier as number))
      : 1

  const kind = parseSimilarItineraryCompareKind(opts.kind)
  const bundle = await loadSimilarItineraryCompare({ place, duration, kind })
  const presentOrigins = bundle.rows.map((r) => r.supplierKey)
  const missingSuppliers = bundle.missingSuppliers
  const targeted = resolveCompareClusterGapIngestTargets({
    presentOrigins,
    onlySuppliers: opts.onlySuppliers,
  })

  const result: CompareClusterGapIngestResult = {
    place,
    duration,
    missingSuppliers,
    targeted,
    created: 0,
    skippedDuplicate: 0,
    skippedNoListing: [],
    failed: 0,
    dryRun,
    bySupplier: {},
  }

  if (targeted.length === 0) {
    console.error('[compare-cluster-gap-ingest] no missing suppliers', { place, duration })
    return result
  }

  const knownKeys = await loadKnownDedupeKeys()
  console.error('[compare-cluster-gap-ingest] start', {
    place,
    duration,
    missingSuppliers,
    targeted,
    perSupplier,
    dryRun,
  })

  for (const supplier of targeted) {
    if (!isRegisterPrePhotoIngestSupplier(supplier)) continue
    const bucket = { created: 0, skipped: 0, failed: 0, reasons: [] as string[] }
    result.bySupplier[supplier] = bucket
    const slot = forcedPlaceSlot(supplier, place)
    const slotLabel = ingestSlotLabel(slot)

    await waitListingHumanPause(supplier)
    let found = new Map<string, string[]>()
    try {
      found = await listingUrlMapForSupplier(supplier, [slot])
    } catch (e) {
      result.failed += 1
      bucket.failed += 1
      bucket.reasons.push(`discover_throw:${String(e instanceof Error ? e.message : e).slice(0, 120)}`)
      console.error('[compare-cluster-gap-ingest] discover', supplier, e)
      await waitListingHumanPause(supplier)
      continue
    }

    const urls = found.get(slotLabel) ?? []
    console.error('[compare-cluster-gap-ingest] discover-ok', supplier, slotLabel, urls.length)
    if (!urls.length) {
      result.skippedNoListing.push(slotLabel)
      bucket.reasons.push('no_listing')
      continue
    }

    const isKnown = (originUrl: string) => registerPrePhotoListingUrlIsKnown(supplier, originUrl, knownKeys)
    const unknownUrls = pickUnknownListingUrlsUntilQuota([urls], isKnown, Math.max(perSupplier * 4, 4))
    result.skippedDuplicate += urls.length - unknownUrls.length
    bucket.skipped += urls.length - unknownUrls.length

    for (const originUrl of unknownUrls) {
      if (bucket.created >= perSupplier) break
      try {
        // REGRESSION-FREEZE[compare-cluster-supplier-gap-ingest]: confirmRegisterPendingFromOriginUrl — manifest
        const confirm = await confirmRegisterPendingFromOriginUrl({
          supplier,
          originUrl,
          dryRun,
          ingestLane: 'package',
        })
        if (!confirm.ok && confirm.reason === 'lane_mismatch') {
          bucket.skipped += 1
          continue
        }
        if (!confirm.ok && (confirm.reason === 'duplicate_title' || confirm.reason === 'domestic_korea_rejected')) {
          result.skippedDuplicate += 1
          bucket.skipped += 1
          bucket.reasons.push(String(confirm.reason))
          for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
            knownKeys.add(`${k.kind}:${k.value}`)
          }
          await waitListingHumanPause(supplier)
          continue
        }
        if (dryRun && confirm.ok) {
          result.created += 1
          bucket.created += 1
          bucket.reasons.push(`dry_run:${originUrl.slice(0, 80)}`)
          for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
            knownKeys.add(`${k.kind}:${k.value}`)
          }
          await waitListingHumanPause(supplier)
          continue
        }
        if (!confirm.ok) {
          result.failed += 1
          bucket.failed += 1
          bucket.reasons.push(String(confirm.reason ?? 'confirm_fail'))
          if (
            confirm.productId ||
            confirm.reason === 'pre_photo_verify_failed' ||
            confirm.reason === 'origin_unsellable' ||
            confirm.reason === 'title_placeholder_not_persisted'
          ) {
            for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
              knownKeys.add(`${k.kind}:${k.value}`)
            }
          }
          await waitListingHumanPause(supplier)
          continue
        }
        result.created += 1
        bucket.created += 1
        bucket.reasons.push(`created:${confirm.productId ?? originUrl.slice(0, 60)}`)
        // REGRESSION-FREEZE[pending-compare-gap-priority]: 등록대기 우선 정렬 스탬프 — manifest
        if (confirm.productId) {
          await markProductCompareClusterGapPriority(confirm.productId)
        }
        for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
          knownKeys.add(`${k.kind}:${k.value}`)
        }
        await waitListingHumanPause(supplier)
      } catch (e) {
        result.failed += 1
        bucket.failed += 1
        bucket.reasons.push(`confirm_throw:${String(e instanceof Error ? e.message : e).slice(0, 120)}`)
        console.error('[compare-cluster-gap-ingest] confirm', supplier, originUrl, e)
        await waitListingHumanPause(supplier)
      }
    }
    await waitListingHumanPause(supplier)
  }

  console.error('[compare-cluster-gap-ingest] done', {
    place,
    created: result.created,
    skippedDuplicate: result.skippedDuplicate,
    failed: result.failed,
    bySupplier: result.bySupplier,
  })
  return result
}
