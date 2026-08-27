/**
 * 일일 수집 슬롯 — 등록된 공급사마다 패키지·자유여행 각각
 * 나라만 있으면 나라 1개, 도시가 있으면 도시별 1개.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 1/country-or-city · 레인별 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: max slots per supplier per run — manifest
 */
import { resolveRegisterAdminLane } from '@/lib/register-admin-lane'
import { inferRegisterFactProductKindFromOriginUrl } from '@/lib/register-facts/product-kind'
import type { RegisterFactProductKind } from '@/lib/register-facts/product-kind'
import type { SupplierRegisterFactSource } from '@/lib/register-facts/types'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { normalizeRegisterOriginUrl } from '@/lib/register-product-duplicate-guard'
import { occupiesRegisterPrePhotoIngestSlot } from '@/lib/register-pre-photo-pending-queue'

export const REGISTER_PRE_PHOTO_INGEST_LANES = ['package', 'air_hotel_free'] as const
export type RegisterPrePhotoIngestLane = (typeof REGISTER_PRE_PHOTO_INGEST_LANES)[number]

/** 슬롯당 미등록 1건 — 3건 한도 아님 */
export const REGISTER_PRE_PHOTO_INGEST_PER_GEO = 1

/**
 * Playwright 목록은 공급사당 브라우저 1개.
 * 312슬롯을 하루에 다 열면 가격 스윕과 겹친다. 날짜로 돌려가며 자른다.
 * REGRESSION-FREEZE[register-listing-discover-playwright]: max slots per supplier per run — manifest
 */
export const REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN = 4

export function registerPrePhotoIngestMaxSlotsPerSupplier(): number {
  const raw = Number(process.env.REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER ?? '')
  if (Number.isFinite(raw) && raw >= 1) return Math.min(24, Math.floor(raw))
  return REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN
}

export function rotateRegisterPrePhotoIngestSlots<T>(
  slots: readonly T[],
  dayKey: string,
  take: number,
): T[] {
  if (take <= 0 || slots.length === 0) return []
  if (slots.length <= take) return [...slots]
  let h = 2166136261
  for (let i = 0; i < dayKey.length; i++) {
    h ^= dayKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const start = Math.abs(h) % slots.length
  return [...slots.slice(start), ...slots.slice(0, start)].slice(0, take)
}

export type RegisterPrePhotoIngestProductRow = {
  originSource: string | null
  originUrl: string | null
  registrationStatus: string | null
  countryKey: string | null
  cityKey: string | null
  destination: string | null
  listingKind?: string | null
  productType?: string | null
  sportsThemeTag?: readonly string[] | null
}

export type RegisterPrePhotoIngestGeoSlot = {
  supplier: string
  lane: RegisterPrePhotoIngestLane
  countryKey: string
  cityKey: string | null
  originUrl: string
  destination: string | null
  searchWord: string
  pending: number
}

const INGEST_SUPPLIERS = ['hanatour', 'modetour', 'verygoodtour', 'ybtour'] as const

export function isRegisterPrePhotoIngestSupplier(s: string): boolean {
  return (INGEST_SUPPLIERS as readonly string[]).includes(s)
}

export function ingestLaneFromProductRow(
  row: Pick<RegisterPrePhotoIngestProductRow, 'listingKind' | 'productType' | 'sportsThemeTag'>,
): RegisterPrePhotoIngestLane {
  const lane = resolveRegisterAdminLane({
    listingKind: row.listingKind,
    productType: row.productType,
    sportsThemeTag: row.sportsThemeTag,
  })
  return lane === 'air_hotel_free' ? 'air_hotel_free' : 'package'
}

export function travelScopeForIngestLane(
  lane: RegisterPrePhotoIngestLane,
): 'overseas' | 'air_hotel_free' {
  return lane === 'air_hotel_free' ? 'air_hotel_free' : 'overseas'
}

export function ingestGeoSlotKey(countryKey: string, cityKey: string | null): string {
  const country = countryKey.trim()
  const city = String(cityKey ?? '').trim()
  return city ? `${country}::${city}` : `${country}::`
}

export function ybtourListingMenuForIngestLane(lane: RegisterPrePhotoIngestLane): 'PKG' | 'FIT' {
  return lane === 'air_hotel_free' ? 'FIT' : 'PKG'
}


function searchWordForSlot(args: {
  cityKey: string | null
  destination: string | null
  countryKey: string
}): string {
  const dest = String(args.destination ?? '').trim()
  if (dest) return dest
  const city = String(args.cityKey ?? '').trim()
  if (city) return city
  return args.countryKey.trim()
}

/** URL로 패키지/자유여행을 가를 수 있는 공급사만 목록 단계에서 걸러낸다. */
export function listingUrlMatchesIngestLane(
  supplier: SupplierRegisterFactSource,
  originUrl: string,
  lane: RegisterPrePhotoIngestLane,
): boolean {
  if (supplier !== 'ybtour' && supplier !== 'verygoodtour' && supplier !== 'kyowontour') {
    return true
  }
  const inferred = inferRegisterFactProductKindFromOriginUrl(supplier, originUrl)
  return factKindMatchesIngestLane(inferred, lane)
}

export function factKindMatchesIngestLane(
  kind: RegisterFactProductKind,
  lane: RegisterPrePhotoIngestLane,
): boolean {
  if (lane === 'air_hotel_free') return kind === 'air_hotel_free'
  return kind === 'package'
}

type SeedCell = {
  originByLane: Partial<Record<RegisterPrePhotoIngestLane, string>>
  anyOriginUrl: string
  destination: string | null
  pendingByLane: Record<RegisterPrePhotoIngestLane, number>
}

function emptyPending(): Record<RegisterPrePhotoIngestLane, number> {
  return { package: 0, air_hotel_free: 0 }
}

/**
 * 공급사별 등록 geo 트리. 그 나라에 도시가 하나라도 있으면 도시 슬롯만,
 * 나라만 있으면 나라 슬롯 1개. 패키지·자유여행 레인을 각각 붙인다.
 */
export function buildRegisterPrePhotoIngestGeoSlots(
  rows: readonly RegisterPrePhotoIngestProductRow[],
): RegisterPrePhotoIngestGeoSlot[] {
  type CountryCities = { cities: Set<string>; hasCountryOnly: boolean }
  const citiesBySupplierCountry = new Map<string, CountryCities>()
  const cells = new Map<string, SeedCell>()

  const bumpCountry = (supplier: string, country: string, city: string | null) => {
    const k = `${supplier}::${country}`
    let rec = citiesBySupplierCountry.get(k)
    if (!rec) {
      rec = { cities: new Set(), hasCountryOnly: false }
      citiesBySupplierCountry.set(k, rec)
    }
    if (city) rec.cities.add(city)
    else rec.hasCountryOnly = true
  }

  const cellKey = (supplier: string, country: string, city: string | null) =>
    `${supplier}::${ingestGeoSlotKey(country, city)}`

  for (const p of rows) {
    const supplier = normalizeSupplierOrigin(p.originSource)
    if (!supplier || !isRegisterPrePhotoIngestSupplier(supplier)) continue
    const country = String(p.countryKey ?? '').trim()
    if (!country) continue
    const city = String(p.cityKey ?? '').trim() || null
    bumpCountry(supplier, country, city)

    const lane = ingestLaneFromProductRow(p)
    const url = normalizeRegisterOriginUrl(p.originUrl)
    const ck = cellKey(supplier, country, city)
    let cell = cells.get(ck)
    if (!cell) {
      cell = {
        originByLane: {},
        anyOriginUrl: url,
        destination: p.destination ?? null,
        pendingByLane: emptyPending(),
      }
      cells.set(ck, cell)
    }
    if (url) {
      if (!cell.anyOriginUrl) cell.anyOriginUrl = url
      if (!cell.originByLane[lane]) cell.originByLane[lane] = url
    }
    if (p.destination && !cell.destination) cell.destination = p.destination
    if (occupiesRegisterPrePhotoIngestSlot(p.registrationStatus)) cell.pendingByLane[lane] += 1
  }

  const slots: RegisterPrePhotoIngestGeoSlot[] = []
  for (const [scKey, rec] of citiesBySupplierCountry.entries()) {
    const sep = scKey.indexOf('::')
    const supplier = scKey.slice(0, sep)
    const country = scKey.slice(sep + 2)
    const useCities = rec.cities.size > 0
    const geos: Array<{ cityKey: string | null }> = useCities
      ? [...rec.cities].sort().map((cityKey) => ({ cityKey }))
      : rec.hasCountryOnly
        ? [{ cityKey: null }]
        : []

    for (const { cityKey } of geos) {
      const cell = cells.get(cellKey(supplier, country, cityKey))
      if (!cell?.anyOriginUrl) continue
      for (const lane of REGISTER_PRE_PHOTO_INGEST_LANES) {
        const originUrl = cell.originByLane[lane] || cell.anyOriginUrl
        if (!originUrl) continue
        slots.push({
          supplier,
          lane,
          countryKey: country,
          cityKey,
          originUrl,
          destination: cell.destination,
          searchWord: searchWordForSlot({
            cityKey,
            destination: cell.destination,
            countryKey: country,
          }),
          pending: cell.pendingByLane[lane],
        })
      }
    }
  }

  slots.sort((a, b) => {
    const s = a.supplier.localeCompare(b.supplier)
    if (s !== 0) return s
    const l = (a.lane === 'package' ? 0 : 1) - (b.lane === 'package' ? 0 : 1)
    if (l !== 0) return l
    const c = a.countryKey.localeCompare(b.countryKey)
    if (c !== 0) return c
    return String(a.cityKey ?? '').localeCompare(String(b.cityKey ?? ''))
  })
  return slots
}
