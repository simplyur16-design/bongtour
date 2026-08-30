/**
 * 일일 수집 검색 시드 — 등록된 공급사마다 패키지·자유여행 각각
 * 나라만 있으면 나라 1개, 도시가 있으면 도시별 1개. 이미 있는 상품은 건너뛰고 공급사당 3건.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: 검색 시드 geo · 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-three-per-supplier-night-window]: 공급사당 3건 — manifest
 * REGRESSION-FREEZE[register-listing-discover-playwright]: max slots per supplier per run — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-keep-looking-until-quota]: 중복 스킵 후 할당량까지 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: 연타 spawn 금지 · 할당량까지 다음 geo — manifest
 * REGRESSION-FREEZE[register-listing-discover-overseas-click]: 메가메뉴 나라·도시만 클릭 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: canonical 7사 동일 클릭·검증 — manifest
 */
import { resolveRegisterAdminLane } from '@/lib/register-admin-lane'
import {
  inferHanatourListingProductKindFromOriginUrl,
  inferRegisterFactProductKindFromOriginUrl,
  type RegisterFactProductKind,
} from '@/lib/register-facts/product-kind'
import type { SupplierRegisterFactSource } from '@/lib/register-facts/types'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { normalizeRegisterOriginUrl } from '@/lib/register-product-duplicate-guard'
import { occupiesRegisterPrePhotoIngestSlot } from '@/lib/register-pre-photo-pending-queue'
import { megaMenuClickLabelForIngestSlot } from '@/lib/mega-menu-click-label'
import {
  CANONICAL_OVERSEAS_SUPPLIER_KEYS,
  type CanonicalOverseasSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'

export const REGISTER_PRE_PHOTO_INGEST_LANES = ['package', 'air_hotel_free'] as const
export type RegisterPrePhotoIngestLane = (typeof REGISTER_PRE_PHOTO_INGEST_LANES)[number]

/** 목록 검색 시드는 geo당 1페이지. 생성 한도는 공급사당 3건. */
export const REGISTER_PRE_PHOTO_INGEST_PER_GEO = 1

/** 이미 등록된 URL은 건너뛰고, 공급사마다 하루에 신규 3건. */
export const REGISTER_PRE_PHOTO_INGEST_PER_SUPPLIER = 3

/**
 * Playwright 목록은 공급사당 브라우저 1세션. 가격스윕(수백 geo)과 분리.
 * 이미 있는 URL이면 그 장에서 끝내지 않고 할당량 3을 채울 때까지 다음 geo를 본다.
 * REGRESSION-FREEZE[register-listing-discover-playwright]: max slots per supplier per run — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-keep-looking-until-quota]: 중복 스킵 후 할당량까지 — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: 연타 spawn 금지 · 할당량까지 다음 geo — manifest
 */
export const REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN = 24

export function registerPrePhotoIngestMaxSlotsPerSupplier(): number {
  const raw = Number(process.env.REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER ?? '')
  if (Number.isFinite(raw) && raw >= 1) return Math.min(80, Math.floor(raw))
  // 24장까지 이어서 본다. 브라우저는 geo마다 새로 띄우지 않는다.
  return REGISTER_PRE_PHOTO_INGEST_MAX_SLOTS_PER_SUPPLIER_PER_RUN
}

/** 내일투어는 자유여행이 본업. FIT를 먼저 채우고 패키지는 남는 칸만. */
// REGRESSION-FREEZE[register-pre-photo-ingest-naeiltour-fit-first]: naeiltour FIT 우선 — manifest
export function orderRegisterPrePhotoIngestSlotsForSupplier<T>(
  supplier: string,
  pkg: readonly T[],
  fit: readonly T[],
): T[] {
  if (supplier === 'naeiltour') return [...fit, ...pkg]
  return interleaveRegisterPrePhotoIngestLanes(pkg, fit)
}

/** 패키지·자유여행 슬롯을 번갈아 본다. 패키지만 24장 쓰면 자유여행 메뉴를 안 누른다. */
// REGRESSION-FREEZE[register-pre-photo-ingest-pkg-fit-theme-kind]: pkg·FIT 교차 — manifest
export function interleaveRegisterPrePhotoIngestLanes<T>(pkg: readonly T[], fit: readonly T[]): T[] {
  const out: T[] = []
  const n = Math.max(pkg.length, fit.length)
  for (let i = 0; i < n; i++) {
    if (i < pkg.length) out.push(pkg[i] as T)
    if (i < fit.length) out.push(fit[i] as T)
  }
  return out
}

export function rotateRegisterPrePhotoIngestSlots<T>(
  slots: readonly T[],
  dayKey: string,
  take: number,
): T[] {
  if (take <= 0 || slots.length === 0) return []
  const n = Math.min(take, slots.length)
  let h = 2166136261
  for (let i = 0; i < dayKey.length; i++) {
    h ^= dayKey.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const start = Math.abs(h) % slots.length
  return [...slots.slice(start), ...slots.slice(0, start)].slice(0, n)
}

/** 목록이 전부 이미 있어도 다음 슬롯을 이어서, 공급사당 3건을 채운다. */
export function pickUnknownListingUrlsUntilQuota(
  slotUrlLists: readonly (readonly string[])[],
  isKnown: (url: string) => boolean,
  quota: number,
): string[] {
  if (quota <= 0) return []
  const out: string[] = []
  for (const urls of slotUrlLists) {
    for (const url of urls) {
      if (isKnown(url)) continue
      out.push(url)
      if (out.length >= quota) return out
    }
  }
  return out
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

export const REGISTER_PRE_PHOTO_INGEST_SUPPLIERS = CANONICAL_OVERSEAS_SUPPLIER_KEYS
export type RegisterPrePhotoIngestSupplier = CanonicalOverseasSupplierKey

export function isRegisterPrePhotoIngestSupplier(s: string): s is RegisterPrePhotoIngestSupplier {
  return (REGISTER_PRE_PHOTO_INGEST_SUPPLIERS as readonly string[]).includes(s)
}

/** 시드 상세가 없어도 홈에서 해외여행을 누른다. 목록 404 주소를 만들지 않는다. */
export function ingestSupplierBrowseHome(supplier: RegisterPrePhotoIngestSupplier): string {
  switch (supplier) {
    case 'hanatour':
      return 'https://www.hanatour.com/'
    case 'modetour':
      return 'https://www.modetour.com/'
    case 'verygoodtour':
      return 'https://www.verygoodtour.com/'
    case 'ybtour':
      return 'https://www.ybtour.co.kr/'
    case 'kyowontour':
      return 'https://www.kyowontour.com/'
    case 'lottetour':
      return 'https://www.lottetour.com/'
    case 'naeiltour':
      return 'https://www.naeiltour.co.kr/'
  }
}

/** 운영 oneshot — `modetour,verygoodtour` 처럼 해당 공급사만. 비면 canonical 전부. */
export function parseRegisterPrePhotoIngestOnlySuppliers(
  raw: string | null | undefined,
): RegisterPrePhotoIngestSupplier[] | null {
  if (raw == null || !String(raw).trim()) return null
  const out: RegisterPrePhotoIngestSupplier[] = []
  const seen = new Set<string>()
  for (const part of String(raw).split(/[,\s]+/)) {
    const n = normalizeSupplierOrigin(part.trim())
    if (!n || !isRegisterPrePhotoIngestSupplier(n) || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out.length ? out : null
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
  const mega = megaMenuClickLabelForIngestSlot({
    cityKey: args.cityKey,
    countryKey: args.countryKey,
  })
  if (mega) return mega
  return ''
}

/** URL로 가를 수 있으면 목록 단계에서 걸러낸다. 하나투어 미상·모두투어는 API 프로브. */
// REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: hanatour pkgCd 목록 레인 — manifest
export function listingUrlMatchesIngestLane(
  supplier: SupplierRegisterFactSource,
  originUrl: string,
  lane: RegisterPrePhotoIngestLane,
): boolean {
  if (supplier === 'hanatour') {
    const guessed = inferHanatourListingProductKindFromOriginUrl(originUrl)
    if (guessed == null) return true
    return factKindMatchesIngestLane(guessed, lane)
  }
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
 * 등록된 geo는 공급사 공유. 그 나라에 도시가 하나라도 있으면 도시 슬롯만,
 * 나라만 있으면 나라 슬롯 1개. canonical 전부 같은 메가메뉴를 누른다.
 * 시드 URL이 없는 공급사는 홈에서 시작한다.
 */
export function buildRegisterPrePhotoIngestGeoSlots(
  rows: readonly RegisterPrePhotoIngestProductRow[],
): RegisterPrePhotoIngestGeoSlot[] {
  type CountryCities = { cities: Set<string>; hasCountryOnly: boolean }
  const citiesByCountry = new Map<string, CountryCities>()
  const cells = new Map<string, SeedCell>()

  const bumpCountry = (country: string, city: string | null) => {
    let rec = citiesByCountry.get(country)
    if (!rec) {
      rec = { cities: new Set(), hasCountryOnly: false }
      citiesByCountry.set(country, rec)
    }
    if (city) rec.cities.add(city)
    else rec.hasCountryOnly = true
  }

  const cellKey = (supplier: string, country: string, city: string | null) =>
    `${supplier}::${ingestGeoSlotKey(country, city)}`

  for (const p of rows) {
    const supplier = normalizeSupplierOrigin(p.originSource)
    if (!supplier) continue
    const country = String(p.countryKey ?? '').trim()
    if (!country) continue
    const city = String(p.cityKey ?? '').trim() || null
    bumpCountry(country, city)

    if (!isRegisterPrePhotoIngestSupplier(supplier)) continue
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
  for (const supplier of REGISTER_PRE_PHOTO_INGEST_SUPPLIERS) {
    for (const [country, rec] of citiesByCountry.entries()) {
      const useCities = rec.cities.size > 0
      const geos: Array<{ cityKey: string | null }> = useCities
        ? [...rec.cities].sort().map((cityKey) => ({ cityKey }))
        : rec.hasCountryOnly
          ? [{ cityKey: null }]
          : []

      for (const { cityKey } of geos) {
        const cell = cells.get(cellKey(supplier, country, cityKey))
        const searchWord = searchWordForSlot({
          cityKey,
          destination: cell?.destination ?? null,
          countryKey: country,
        })
        if (!searchWord) continue
        for (const lane of REGISTER_PRE_PHOTO_INGEST_LANES) {
          const originUrl =
            cell?.originByLane[lane] || cell?.anyOriginUrl || ingestSupplierBrowseHome(supplier)
          slots.push({
            supplier,
            lane,
            countryKey: country,
            cityKey,
            originUrl,
            destination: cell?.destination ?? null,
            searchWord,
            pending: cell?.pendingByLane[lane] ?? 0,
          })
        }
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
