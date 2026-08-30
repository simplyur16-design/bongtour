/**
 * 이미 등록된 상품은 건너뛰고, 공급사마다 하루 신규 3건.
 * 큐 leftover(등록대기 12건 등)는 오늘 한도를 채운 것이 아니다. 같은 URL만 건너뛴다.
 * 목록 검색 시드는 기존 geo(나라/도시)·레인. 공급사별 모듈·간격 분리. 사진 생성 없음.
 * 검증 통과한 것만 등록대기. 실패는 큐·geo 슬롯을 안 잡고, 다음 URL을 이어서 받는다.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 검색 시드 geo · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 등록된 URL 스킵 · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 실패는 슬롯을 안 잡아 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: Playwright batch · rotate start — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-keep-looking-until-quota]: 있는 URL 스킵 후 3건까지 다음 목록 — manifest
 * REGRESSION-FREEZE[register-listing-discover-no-seed-detail]: 시드 상세를 목록으로 쓰지 않음 — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 하나투어·모두투어 목록 레인 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: sessionSlots 한 브라우저 · 빈 목록으로 포기 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: canonical 7사 동일 클릭·검증 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-pkg-fit-theme-kind]: pkg·FIT 교차 · 테마 태그 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-naeiltour-fit-first]: naeiltour 자유여행 우선 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 패키지 노옵션·노쇼핑 우선 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-night-leftover-not-quota]: leftover pending ≠ 오늘 할당량 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-no-option-no-shopping]: 패키지 노옵션·노쇼핑 우선 — manifest
 * REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]: origin_unsellable 은 같은 밤 재시도 금지 — manifest
 */
import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { extractRegisterProductDedupeKeys } from '@/lib/register-product-duplicate-guard'
import { parseYbtourEvCdFromUrl, parseYbtourGoodsCdFromUrl } from '@/lib/ybtour-api-departures'
import {
  YBTOUR_LISTING_PAGES_PER_BROWSER,
  fetchYbtourListingDetailUrlMap,
  waitYbtourListingHumanPause,
} from '@/lib/register-listing-discover-ybtour'
import {
  HANATOUR_LISTING_PAGES_PER_BROWSER,
  fetchHanatourListingDetailUrlMap,
  waitHanatourListingHumanPause,
} from '@/lib/register-listing-discover-hanatour'
import {
  MODETOUR_LISTING_PAGES_PER_BROWSER,
  fetchModetourListingDetailUrlMap,
  waitModetourListingHumanPause,
} from '@/lib/register-listing-discover-modetour'
import {
  VERYGOODTOUR_LISTING_PAGES_PER_BROWSER,
  fetchVerygoodtourListingDetailUrlMap,
  waitVerygoodtourListingHumanPause,
} from '@/lib/register-listing-discover-verygoodtour'
import {
  KYOWONTOUR_LISTING_PAGES_PER_BROWSER,
  fetchKyowontourListingDetailUrlMap,
  waitKyowontourListingHumanPause,
} from '@/lib/register-listing-discover-kyowontour'
import {
  LOTTETOUR_LISTING_PAGES_PER_BROWSER,
  fetchLottetourListingDetailUrlMap,
  waitLottetourListingHumanPause,
} from '@/lib/register-listing-discover-lottetour'
import {
  NAEILTOUR_LISTING_PAGES_PER_BROWSER,
  fetchNaeiltourListingDetailUrlMap,
  waitNaeiltourListingHumanPause,
} from '@/lib/register-listing-discover-naeiltour'
import { kstTodayYmd } from '@/lib/calendar-ymd'
import {
  REGISTER_PRE_PHOTO_INGEST_PER_GEO,
  REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER,
  REGISTER_PRE_PHOTO_INGEST_SUPPLIERS,
  buildRegisterPrePhotoIngestGeoSlots,
  interleaveRegisterPrePhotoIngestLanes,
  isRegisterPrePhotoIngestSupplier,
  listingUrlMatchesIngestLane,
  registerPrePhotoIngestMaxSlotsPerSupplier,
  rotateRegisterPrePhotoIngestSlots,
  pickUnknownListingUrlsUntilQuota,
  parseRegisterPrePhotoIngestOnlySuppliers,
  orderRegisterPrePhotoIngestSlotsForSupplier,
  ybtourListingMenuForIngestLane,
  type RegisterPrePhotoIngestGeoSlot,
  type RegisterPrePhotoIngestLane,
  type RegisterPrePhotoIngestSupplier,
} from '@/lib/register-pre-photo-ingest-geo-slots'
import { confirmRegisterPendingFromOriginUrl } from '@/lib/register-pre-photo-ingest-confirm'
import { discoveredListingFitsIngestLane } from '@/lib/register-pre-photo-listing-lane-filter'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { SupplierRegisterFactSource } from '@/lib/register-facts/types'

type IngestSupplier = RegisterPrePhotoIngestSupplier

function asIngestSupplier(s: string): IngestSupplier | null {
  return isRegisterPrePhotoIngestSupplier(s) ? s : null
}

export type IngestUnregisteredPrePhotoOpts = {
  dryRun?: boolean
  onlySuppliers?: string[]
  perSupplier?: number
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

export { interleaveRegisterPrePhotoIngestLanes }

export function registerPrePhotoListingUrlIsKnown(
  supplier: IngestSupplier | string,
  originUrl: string,
  knownKeys: ReadonlySet<string>,
): boolean {
  const keys = extractRegisterProductDedupeKeys(supplier, originUrl)
  if (keys.some((k) => knownKeys.has(`${k.kind}:${k.value}`))) return true
  if (normalizeSupplierOrigin(supplier) === 'ybtour') {
    const evCd = parseYbtourEvCdFromUrl(originUrl)
    const goods = (parseYbtourGoodsCdFromUrl(originUrl) ?? evCd?.split('-')[0] ?? '').trim()
    if (goods) {
      const g = goods.toUpperCase()
      for (const k of knownKeys) {
        const u = k.toUpperCase()
        if (u === `ORIGINCODE:YBTOUR:${g}`) return true
        if (u.startsWith(`ORIGINCODE:YBTOUR:${g}-`)) return true
        if (u.startsWith(`SUPPLIERCODE:YBTOUR:EVCD:${g}-`)) return true
      }
    }
  }
  return false
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
    case 'kyowontour':
      return waitKyowontourListingHumanPause()
    case 'lottetour':
      return waitLottetourListingHumanPause()
    case 'naeiltour':
      return waitNaeiltourListingHumanPause()
  }
}

function listingPagesPerBrowser(supplier: IngestSupplier): number {
  switch (supplier) {
    case 'ybtour':
      return YBTOUR_LISTING_PAGES_PER_BROWSER
    case 'hanatour':
      return HANATOUR_LISTING_PAGES_PER_BROWSER
    case 'modetour':
      return MODETOUR_LISTING_PAGES_PER_BROWSER
    case 'verygoodtour':
      return VERYGOODTOUR_LISTING_PAGES_PER_BROWSER
    case 'kyowontour':
      return KYOWONTOUR_LISTING_PAGES_PER_BROWSER
    case 'lottetour':
      return LOTTETOUR_LISTING_PAGES_PER_BROWSER
    case 'naeiltour':
      return NAEILTOUR_LISTING_PAGES_PER_BROWSER
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
    case 'kyowontour':
      return fetchKyowontourListingDetailUrlMap(payload)
    case 'lottetour':
      return fetchLottetourListingDetailUrlMap(payload)
    case 'naeiltour':
      return fetchNaeiltourListingDetailUrlMap(payload)
  }
}

export async function ingestUnregisteredRegisterPendingPrePhoto(
  opts?: IngestUnregisteredPrePhotoOpts,
): Promise<IngestUnregisteredPrePhotoResult> {
  const dryRun = opts?.dryRun === true
  const perGeo = REGISTER_PRE_PHOTO_INGEST_PER_GEO
  const perSupplier =
    Number.isFinite(opts?.perSupplier) && (opts?.perSupplier ?? 0) >= 1
      ? Math.min(3, Math.floor(opts!.perSupplier as number))
      : REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER
  const suppliers =
    parseRegisterPrePhotoIngestOnlySuppliers(opts?.onlySuppliers?.join(',')) ??
    parseRegisterPrePhotoIngestOnlySuppliers(process.env.REGISTER_PRE_PHOTO_INGEST_ONLY) ??
    [...REGISTER_PRE_PHOTO_INGEST_SUPPLIERS]

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
      originSource: { in: [...REGISTER_PRE_PHOTO_INGEST_SUPPLIERS, 'yellowballoon'] },
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
  for (const supplier of suppliers) {
    const mine = slots.filter((s) => s.supplier === supplier)
    const take = Math.min(mine.length, maxListingPages)
    // 패키지·자유여행을 교차한다. 패키지만 앞에 두면 자유여행 메뉴를 안 누른다.
    const pkg = mine.filter((s) => s.lane === 'package')
    const fit = mine.filter((s) => s.lane === 'air_hotel_free')
    const ordered = orderRegisterPrePhotoIngestSlotsForSupplier(
      supplier,
      rotateRegisterPrePhotoIngestSlots(pkg, `${dayKey}::${supplier}::package`, pkg.length),
      rotateRegisterPrePhotoIngestSlots(fit, `${dayKey}::${supplier}::air_hotel_free`, fit.length),
    )
    selected.push(...ordered.slice(0, take))
  }
  console.error('[register-pre-photo-listing-ingest] start', {
    products: products.length,
    slots: slots.length,
    selected: selected.length,
    suppliers,
    perSupplier,
    maxListingPages: Number.isFinite(maxListingPages) ? maxListingPages : 'until-quota',
    dryRun,
  })

  // 목록은 페이지 1장씩, 공급사당 브라우저 1세션. 사이 간격은 공급사 상수.
  // REGRESSION-FREEZE[register-listing-discover-playwright]: 연타 spawn 금지 — manifest
  // REGRESSION-FREEZE[register-listing-discover-human-pace]: sessionSlots 한 브라우저 · 빈 목록으로 포기 금지 — manifest
  for (const supplier of suppliers) {
    console.error('[register-pre-photo-listing-ingest] supplier-start', supplier)
    const mine = selected.filter((s) => s.supplier === supplier)
    let consecutiveDiscoverThrow = 0
    const sessionSize = listingPagesPerBrowser(supplier)
    for (let i = 0; i < mine.length; ) {
      if ((result.bySupplier[supplier] ?? 0) >= perSupplier) break
      const sessionSlots = mine.slice(i, i + sessionSize)
      i += sessionSlots.length
      await waitListingHumanPause(supplier)
      let found = new Map<string, string[]>()
      try {
        found = await listingUrlMapForSupplier(supplier, sessionSlots)
        consecutiveDiscoverThrow = 0
      } catch (e) {
        result.failed += 1
        consecutiveDiscoverThrow += 1
        console.error('[register-pre-photo-listing-ingest] discover', supplier, e)
        if (consecutiveDiscoverThrow >= 6) {
          console.error('[register-pre-photo-listing-ingest] give-up consecutive discover_throw', supplier)
          break
        }
        await waitListingHumanPause(supplier)
        continue
      }
      for (const slot of sessionSlots) {
        if ((result.bySupplier[supplier] ?? 0) >= perSupplier) break
        const slotLabel = ingestSlotLabel(slot)
        result.scannedGeos += 1
        const urls = found.get(slotLabel) ?? []
        console.error('[register-pre-photo-listing-ingest] discover-ok', supplier, slotLabel, urls.length)
        if (!urls.length) {
          result.skippedNoListing.push(slotLabel)
          continue
        }

        const factSource = supplier as SupplierRegisterFactSource
        const isKnown = (originUrl: string) => registerPrePhotoListingUrlIsKnown(supplier, originUrl, knownKeys)
        const unknownUrls = pickUnknownListingUrlsUntilQuota([urls], isKnown, urls.length)
        result.skippedDuplicate += urls.length - unknownUrls.length
        if (!unknownUrls.length) {
          console.error('[register-pre-photo-listing-ingest] all-known', supplier, slotLabel, urls.length)
          continue
        }
        console.error('[register-pre-photo-listing-ingest] unknown', supplier, unknownUrls.length, unknownUrls[0])
        for (const originUrl of unknownUrls) {
          if ((result.bySupplier[supplier] ?? 0) >= perSupplier) break
          if (!listingUrlMatchesIngestLane(factSource, originUrl, slot.lane)) continue
          if (!(await discoveredListingFitsIngestLane(factSource, originUrl, slot.lane))) continue

          try {
            const confirm = await confirmRegisterPendingFromOriginUrl({
              supplier: supplier as CanonicalOverseasSupplierKey,
              originUrl,
              dryRun,
              ingestLane: slot.lane,
              themeHintKeys: [slot.countryKey, slot.cityKey ?? ''],
            })
            if (confirm.reason === 'lane_mismatch') continue
            if (!confirm.ok) {
              result.failed += 1
              console.error('[register-pre-photo-listing-ingest] confirm-fail', supplier, originUrl, confirm.reason)
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
            result.bySupplier[supplier] = (result.bySupplier[supplier] ?? 0) + 1
            result.byLane[slot.lane] += 1
            console.error('[register-pre-photo-listing-ingest] created', supplier, result.bySupplier[supplier], originUrl, confirm.productId)
            for (const k of extractRegisterProductDedupeKeys(supplier, originUrl)) {
              knownKeys.add(`${k.kind}:${k.value}`)
            }
            await waitListingHumanPause(supplier)
          } catch (e) {
            result.failed += 1
            console.error('[register-pre-photo-listing-ingest] confirm', supplier, originUrl, e)
            await waitListingHumanPause(supplier)
          }
        }
      }
      await waitListingHumanPause(supplier)
    }
    console.error('[register-pre-photo-listing-ingest] supplier-done', supplier, result.bySupplier[supplier] ?? 0)
  }

  return result
}
