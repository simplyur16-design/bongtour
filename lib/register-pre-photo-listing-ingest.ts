/**
 * 등록된 공급사마다 패키지·자유여행 각각 — 나라만 있으면 나라 1개, 도시가 있으면 도시별 1개.
 * 공급사별 모듈·간격 분리. 사진 생성 없음. 중복 origin 제외.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 1/country-or-city · 레인별 — manifest
 */
import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { extractRegisterProductDedupeKeys } from '@/lib/register-product-duplicate-guard'
import { fetchYbtourListingDetailUrls, waitYbtourListingHumanPause } from '@/lib/register-listing-discover-ybtour'
import { fetchHanatourListingDetailUrls, waitHanatourListingHumanPause } from '@/lib/register-listing-discover-hanatour'
import { fetchModetourListingDetailUrls, waitModetourListingHumanPause } from '@/lib/register-listing-discover-modetour'
import { fetchVerygoodtourListingDetailUrls, waitVerygoodtourListingHumanPause } from '@/lib/register-listing-discover-verygoodtour'
import {
  REGISTER_PRE_PHOTO_INGEST_PER_GEO,
  buildRegisterPrePhotoIngestGeoSlots,
  isRegisterPrePhotoIngestSupplier,
  listingUrlMatchesIngestLane,
  ybtourListingMenuForIngestLane,
  type RegisterPrePhotoIngestLane,
} from '@/lib/register-pre-photo-ingest-geo-slots'
import { confirmRegisterPendingFromOriginUrl } from '@/lib/register-pre-photo-ingest-confirm'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { SupplierRegisterFactSource } from '@/lib/register-facts/types'

const INGEST_SUPPLIERS = ['hanatour', 'modetour', 'verygoodtour', 'ybtour'] as const
type IngestSupplier = (typeof INGEST_SUPPLIERS)[number]

function asIngestSupplier(s: string): IngestSupplier | null {
  return isRegisterPrePhotoIngestSupplier(s) ? (s as IngestSupplier) : null
}

export type IngestUnregisteredPrePhotoOpts = {
  dryRun?: boolean
}

export type IngestUnregisteredPrePhotoResult = {
  scannedGeos: number
  created: number
  skippedDuplicate: number
  skippedNoListing: string[]
  failed: number
  perGeo: number
  bySupplier: Record<string, number>
  byLane: Record<RegisterPrePhotoIngestLane, number>
}

async function waitListingHumanPause(supplier: IngestSupplier): Promise<void> {
  switch (supplier) {
    case 'ybtour':
      return waitYbtourListingHumanPause()
    case 'hanatour':
      return waitHanatourListingHumanPause()
    case 'modetour':
      return waitModetourListingHumanPause()
    case 'verygoodtour':
      return waitVerygoodtourListingHumanPause()
  }
}

async function listingUrlsForSupplier(args: {
  supplier: IngestSupplier
  seedOriginUrl: string
  searchWord: string
  lane: RegisterPrePhotoIngestLane
}): Promise<string[]> {
  switch (args.supplier) {
    case 'ybtour':
      return fetchYbtourListingDetailUrls({
        seedOriginUrl: args.seedOriginUrl,
        listingMenu: ybtourListingMenuForIngestLane(args.lane),
      })
    case 'hanatour':
      return fetchHanatourListingDetailUrls({
        seedOriginUrl: args.seedOriginUrl,
        searchWord: args.searchWord,
      })
    case 'modetour':
      return fetchModetourListingDetailUrls({
        seedOriginUrl: args.seedOriginUrl,
        searchWord: args.searchWord,
      })
    case 'verygoodtour':
      return fetchVerygoodtourListingDetailUrls({
        seedOriginUrl: args.seedOriginUrl,
        searchWord: args.searchWord,
      })
    default:
      return []
  }
}

export async function ingestUnregisteredRegisterPendingPrePhoto(
  opts?: IngestUnregisteredPrePhotoOpts,
): Promise<IngestUnregisteredPrePhotoResult> {
  const dryRun = opts?.dryRun === true
  const perGeo = REGISTER_PRE_PHOTO_INGEST_PER_GEO

  const result: IngestUnregisteredPrePhotoResult = {
    scannedGeos: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedNoListing: [],
    failed: 0,
    perGeo,
    bySupplier: {},
    byLane: { package: 0, air_hotel_free: 0 },
  }

  const products = await prisma.product.findMany({
    where: {
      originSource: { in: [...INGEST_SUPPLIERS, 'yellowballoon'] },
    },
    select: {
      originSource: true,
      originCode: true,
      originUrl: true,
      registrationStatus: true,
      countryKey: true,
      cityKey: true,
      destination: true,
      listingKind: true,
      productType: true,
      sportsThemeTag: true,
    },
  })

  const knownKeys = new Set<string>()
  for (const p of products) {
    const supplier = normalizeSupplierOrigin(p.originSource)
    if (!supplier || !asIngestSupplier(supplier)) continue
    const keys = extractRegisterProductDedupeKeys(supplier, p.originUrl)
    for (const k of keys) knownKeys.add(`${k.kind}:${k.value}`)
    const code = String(p.originCode ?? '').trim()
    if (code) knownKeys.add(`originCode:${supplier}:${code}`)
  }

  const slots = buildRegisterPrePhotoIngestGeoSlots(products)
  console.error('[register-pre-photo-listing-ingest] start', {
    products: products.length,
    slots: slots.length,
    dryRun,
  })

  for (const slot of slots) {
    const supplier = asIngestSupplier(slot.supplier)
    if (!supplier) continue
    if (slot.pending >= perGeo) continue
    result.scannedGeos += 1
    const slotLabel = `${supplier}::${slot.lane}::${slot.countryKey}::${slot.cityKey ?? ''}`
    const factSource = supplier as SupplierRegisterFactSource

    let urls: string[] = []
    try {
      urls = await listingUrlsForSupplier({
        supplier,
        seedOriginUrl: slot.originUrl,
        searchWord: slot.searchWord,
        lane: slot.lane,
      })
    } catch (e) {
      result.failed += 1
      result.skippedNoListing.push(`${slotLabel}:discover_throw`)
      console.error('[register-pre-photo-listing-ingest] discover', slotLabel, e)
      continue
    }
    if (!urls.length) {
      result.skippedNoListing.push(slotLabel)
      continue
    }

    let createdThisSlot = 0
    const need = perGeo - slot.pending
    for (const originUrl of urls) {
      if (createdThisSlot >= need) break
      const keys = extractRegisterProductDedupeKeys(supplier, originUrl)
      const hit = keys.some((k) => knownKeys.has(`${k.kind}:${k.value}`))
      if (hit) {
        result.skippedDuplicate += 1
        continue
      }
      if (!listingUrlMatchesIngestLane(factSource, originUrl, slot.lane)) continue

      try {
        const confirm = await confirmRegisterPendingFromOriginUrl({
          supplier: supplier as CanonicalOverseasSupplierKey,
          originUrl,
          dryRun,
          ingestLane: slot.lane,
        })
        if (confirm.reason === 'lane_mismatch') continue
        if (!confirm.ok) {
          result.failed += 1
          continue
        }
        result.created += 1
        createdThisSlot += 1
        result.bySupplier[supplier] = (result.bySupplier[supplier] ?? 0) + 1
        result.byLane[slot.lane] += 1
        for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
          knownKeys.add(`${k.kind}:${k.value}`)
        }
        await waitListingHumanPause(supplier)
      } catch (e) {
        result.failed += 1
        console.error('[register-pre-photo-listing-ingest] confirm', supplier, originUrl, e)
      }
    }
  }

  return result
}
