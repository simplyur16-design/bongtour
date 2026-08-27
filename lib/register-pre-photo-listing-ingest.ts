/**
 * 이미 등록된 상품은 건너뛰고, 공급사마다 하루 신규 3건.
 * 목록 검색 시드는 기존 geo(나라/도시)·레인. 공급사별 모듈·간격 분리. 사진 생성 없음.
 * 검증 통과한 것만 등록대기. 실패는 큐·geo 슬롯을 안 잡고, 다음 URL을 이어서 받는다.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 검색 시드 geo · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 등록된 URL 스킵 · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 실패는 슬롯을 안 잡아 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: Playwright batch · rotate cap — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 하나투어·모두투어 목록 레인 — manifest
 */
import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { extractRegisterProductDedupeKeys } from '@/lib/register-product-duplicate-guard'
import { fetchYbtourListingDetailUrlMap, waitYbtourListingHumanPause } from '@/lib/register-listing-discover-ybtour'
import { fetchHanatourListingDetailUrlMap, waitHanatourListingHumanPause } from '@/lib/register-listing-discover-hanatour'
import { fetchModetourListingDetailUrlMap, waitModetourListingHumanPause } from '@/lib/register-listing-discover-modetour'
import { fetchVerygoodtourListingDetailUrlMap, waitVerygoodtourListingHumanPause } from '@/lib/register-listing-discover-verygoodtour'
import { kstTodayYmd } from '@/lib/calendar-ymd'
import {
  REGISTER_PRE_PHOTO_INGEST_PER_GEO,
  REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
  buildRegisterPrePhotoIngestGeoSlots,
  isRegisterPrePhotoIngestSupplier,
  listingUrlMatchesIngestLane,
  registerPrePhotoIngestMaxSlotsPerSupplier,
  rotateRegisterPrePhotoIngestSlots,
  ybtourListingMenuForIngestLane,
  type RegisterPrePhotoIngestGeoSlot,
  type RegisterPrePhotoIngestLane,
} from '@/lib/register-pre-photo-ingest-geo-slots'
import { confirmRegisterPendingFromOriginUrl } from '@/lib/register-pre-photo-ingest-confirm'
import { discoveredListingFitsIngestLane } from '@/lib/register-pre-photo-listing-lane-filter'
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
  perSupplier: number
  bySupplier: Record<string, number>
  byLane: Record<RegisterPrePhotoIngestLane, number>
}

export function registerPrePhotoListingUrlIsKnown(
  supplier: IngestSupplier | string,
  originUrl: string,
  knownKeys: ReadonlySet<string>,
): boolean {
  const keys = extractRegisterProductDedupeKeys(supplier, originUrl)
  return keys.some((k) => knownKeys.has(`${k.kind}:${k.value}`))
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

function ingestSlotLabel(slot: RegisterPrePhotoIngestGeoSlot): string {
  return `${slot.supplier}::${slot.lane}::${slot.countryKey}::${slot.cityKey ?? ''}`
}

async function listingUrlMapForSupplier(
  supplier: IngestSupplier,
  slots: RegisterPrePhotoIngestGeoSlot[],
): Promise<Map<string, string[]>> {
  const payload = slots.map((slot) => ({
    id: ingestSlotLabel(slot),
    searchWord: slot.searchWord,
    seedOriginUrl: slot.originUrl,
    listingMenu: ybtourListingMenuForIngestLane(slot.lane),
  }))
  switch (supplier) {
    case 'ybtour':
      return fetchYbtourListingDetailUrlMap(payload)
    case 'hanatour':
      return fetchHanatourListingDetailUrlMap(payload)
    case 'modetour':
      return fetchModetourListingDetailUrlMap(payload)
    case 'verygoodtour':
      return fetchVerygoodtourListingDetailUrlMap(payload)
    default:
      return new Map()
  }
}

export async function ingestUnregisteredRegisterPendingPrePhoto(
  opts?: IngestUnregisteredPrePhotoOpts,
): Promise<IngestUnregisteredPrePhotoResult> {
  const dryRun = opts?.dryRun === true
  const perGeo = REGISTER_PRE_PHOTO_INGEST_PER_GEO
  const perSupplier = REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER

  const result: IngestUnregisteredPrePhotoResult = {
    scannedGeos: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedNoListing: [],
    failed: 0,
    perGeo,
    perSupplier,
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
  const maxListingPages = registerPrePhotoIngestMaxSlotsPerSupplier()
  const dayKey = kstTodayYmd()
  const selected: RegisterPrePhotoIngestGeoSlot[] = []
  for (const supplier of INGEST_SUPPLIERS) {
    const mine = slots.filter((s) => s.supplier === supplier)
    selected.push(...rotateRegisterPrePhotoIngestSlots(mine, `${dayKey}::${supplier}`, maxListingPages))
  }
  console.error('[register-pre-photo-listing-ingest] start', {
    products: products.length,
    slots: slots.length,
    selected: selected.length,
    perSupplier,
    maxListingPages,
    dryRun,
  })

  const urlMap = new Map<string, string[]>()
  const discoverFailed = new Set<string>()
  for (const supplier of INGEST_SUPPLIERS) {
    const mine = selected.filter((s) => s.supplier === supplier)
    if (mine.length === 0) continue
    try {
      const found = await listingUrlMapForSupplier(supplier, mine)
      for (const [id, urls] of found) urlMap.set(id, urls)
    } catch (e) {
      result.failed += mine.length
      for (const slot of mine) {
        const label = ingestSlotLabel(slot)
        discoverFailed.add(label)
        result.skippedNoListing.push(`${label}:discover_throw`)
      }
      console.error('[register-pre-photo-listing-ingest] discover', supplier, e)
    }
  }

  for (const slot of selected) {
    const supplier = asIngestSupplier(slot.supplier)
    if (!supplier) continue
    if ((result.bySupplier[supplier] ?? 0) >= perSupplier) continue
    const slotLabel = ingestSlotLabel(slot)
    if (discoverFailed.has(slotLabel)) continue
    result.scannedGeos += 1
    const factSource = supplier as SupplierRegisterFactSource
    const urls = urlMap.get(slotLabel) ?? []
    if (!urls.length) {
      result.skippedNoListing.push(slotLabel)
      continue
    }

    for (const originUrl of urls) {
      if ((result.bySupplier[supplier] ?? 0) >= perSupplier) break
      if (registerPrePhotoListingUrlIsKnown(supplier, originUrl, knownKeys)) {
        result.skippedDuplicate += 1
        continue
      }
      if (!listingUrlMatchesIngestLane(factSource, originUrl, slot.lane)) continue
      if (!(await discoveredListingFitsIngestLane(factSource, originUrl, slot.lane))) continue

      try {
        const confirm = await confirmRegisterPendingFromOriginUrl({
          supplier: supplier as CanonicalOverseasSupplierKey,
          originUrl,
          dryRun,
          ingestLane: slot.lane,
        })
        if (confirm.reason === 'lane_mismatch') continue
        if (!confirm.ok) {
          // 실패 건은 슬롯을 안 잡아, 같은 날 다음 URL을 이어서 받는다.
          result.failed += 1
          if (confirm.reason === 'pre_photo_verify_failed') {
            for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
              knownKeys.add(`${k.kind}:${k.value}`)
            }
          }
          continue
        }
        result.created += 1
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
