/**
 * 등록 완료(registered) 패키지 상품 전수 검수 — 공개 상세 표시 SSOT 기준.
 *
 *   npx tsx scripts/audit-public-product-display.ts
 *   npx tsx scripts/audit-public-product-display.ts --json > audit-public-display.json
 */
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import { parseFlightAdminJson, resolveFlightDisplayPolicy, type FlightDisplayPolicy } from '../lib/admin-flight-profile'
import {
  buildDepartureKeyFactsByDepartureId,
  buildDepartureKeyFactsMap,
  enrichDepartureKeyFactsMapForDisplay,
  type DepartureKeyFacts,
} from '../lib/departure-key-facts'
import { alignDepartureKeyFactsToSelectedCalendarDate } from '../lib/departure-facts-calendar-align'
import { publicDepartureLegCardIsPresentable } from '../lib/flight-user-display'
import { getFlightAdminJsonFromRawMeta } from '../lib/raw-meta-admin-flight'
import { normalizeSupplierOrigin, type OverseasSupplierKey } from '../lib/normalize-supplier-origin'
import {
  organizePackageIncludedExcludedForPublicDisplay,
  splitIncludedExcludedForPublicDisplay,
} from '../lib/product-included-excluded-public'
import {
  getPackageOptionalTourRowsFromProduct,
} from '../lib/optional-tours-ui-model'
import {
  parseProductRawMetaPublic,
  parseShoppingStopsJson,
  type FlightStructuredBody,
} from '../lib/public-product-extras'
import * as publicConsumptionHanatour from '../lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '../lib/public-consumption-modetour'
import * as publicConsumptionVerygood from '../lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '../lib/public-consumption-ybtour'
import { extractIsoDate } from '../lib/hero-date-utils'
import { getProductTotalDays } from '../lib/package-rules'

type IssueCode =
  | 'flight_suppressed'
  | 'flight_no_presentable'
  | 'flight_calendar_mismatch'
  | 'optional_missing_public'
  | 'optional_meta_rows_in_db'
  | 'shopping_missing_public'
  | 'ie_empty'
  | 'ie_unorganized_brackets'

type ProductIssue = {
  id: string
  originCode: string
  title: string
  supplier: OverseasSupplierKey
  productType: string | null
  issues: IssueCode[]
  detail: Record<string, string | number | boolean>
}

const PACKAGE_TYPES = new Set(['travel', 'private', 'semi'])
/** `listingKind` air_hotel_free — 패키지 상세와 동일 파이프라인 */
function isAirHotelFreeListing(listingKind: string | null | undefined): boolean {
  return (listingKind ?? '').trim() === 'air_hotel_free'
}

function isMetaOnlyOptionalName(name: string): boolean {
  const t = name.replace(/\s+/g, ' ').trim()
  return /^소요시간\b/i.test(t) || /^미선택시\s*가이드/i.test(t) || /^대체일정\b/i.test(t)
}

function resolveShoppingConsumption(
  supplier: OverseasSupplierKey,
  structured: ReturnType<typeof parseProductRawMetaPublic>['structuredSignals'],
  shoppingShopOptions: string | null,
  optionalToursStructured: string | null
) {
  const input = {
    canonical: structured?.shoppingStructured,
    legacyDbRows: parseShoppingStopsJson(shoppingShopOptions ?? null),
    legacyMetaRows: parseShoppingStopsJson(structured?.shoppingStops ?? null),
  }
  switch (supplier) {
    case 'modetour':
      return publicConsumptionModetour.resolveShoppingConsumption(input)
    case 'verygoodtour':
      return publicConsumptionVerygood.resolveShoppingConsumption(input)
    case 'ybtour':
      return publicConsumptionYbtour.resolveShoppingConsumption(input)
    default:
      return publicConsumptionHanatour.resolveShoppingConsumption(input)
  }
}

function resolveOptionalConsumption(
  supplier: OverseasSupplierKey,
  structured: ReturnType<typeof parseProductRawMetaPublic>['structuredSignals'],
  optionalToursStructured: string | null
) {
  const input = {
    canonical: structured?.optionalToursStructuredCanonical,
    legacyOptionalToursStructured: optionalToursStructured ?? null,
  }
  switch (supplier) {
    case 'modetour':
      return publicConsumptionModetour.resolveOptionalToursConsumption(input)
    case 'verygoodtour':
      return publicConsumptionVerygood.resolveOptionalToursConsumption(input)
    case 'ybtour':
      return publicConsumptionYbtour.resolveOptionalToursConsumption(input)
    default:
      return publicConsumptionHanatour.resolveOptionalToursConsumption(input)
  }
}

function countMetaOnlyOptionalRows(optionalToursStructured: string | null): number {
  if (!optionalToursStructured?.trim()) return 0
  try {
    const parsed = JSON.parse(optionalToursStructured) as unknown
    const arr = Array.isArray(parsed) ? parsed : []
    return arr.filter((r) => {
      const row = r as { name?: string; tourName?: string }
      const name = (row.name ?? row.tourName ?? '').trim()
      return name && isMetaOnlyOptionalName(name)
    }).length
  } catch {
    return 0
  }
}

function buildPublicFactsByDate(
  adminRaw: string | null,
  departures: Array<{
    id: string
    departureDate: Date
    carrierName: string | null
    outboundFlightNo: string | null
    outboundDepartureAirport: string | null
    outboundDepartureAt: Date | null
    outboundArrivalAirport: string | null
    outboundArrivalAt: Date | null
    inboundFlightNo: string | null
    inboundDepartureAirport: string | null
    inboundDepartureAt: Date | null
    inboundArrivalAirport: string | null
    inboundArrivalAt: Date | null
    meetingInfoRaw: string | null
  }>,
  flightStructured: FlightStructuredBody | null,
  airline: string | null,
  flightDisplayPolicy: FlightDisplayPolicy,
  verygoodRowOnly: boolean
): { byDate: Record<string, DepartureKeyFacts>; byId: Record<string, DepartureKeyFacts> } {
  const baseByDate = departures.length > 0 ? buildDepartureKeyFactsMap(departures as never) : {}
  const byId = departures.length > 0 ? buildDepartureKeyFactsByDepartureId(departures as never) : {}
  const parsedByDate =
    departures.length > 0
      ? verygoodRowOnly
        ? baseByDate
        : enrichDepartureKeyFactsMapForDisplay(baseByDate, flightStructured, airline)
      : {}

  const adminProfile = adminRaw ? parseFlightAdminJson(adminRaw) : null

  let byDate: Record<string, DepartureKeyFacts> | undefined = parsedByDate
  if (departures.length === 0) {
    byDate = undefined
  } else if (flightDisplayPolicy === 'suppress_no_parsed') {
    byDate = Object.fromEntries(
      Object.keys(baseByDate).map((dateKey) => [
        dateKey,
        {
          airline: baseByDate[dateKey]?.airline ?? airline ?? null,
          outbound: null,
          inbound: null,
          outboundSummary: null,
          inboundSummary: null,
          meetingSummary: baseByDate[dateKey]?.meetingSummary ?? null,
        },
      ])
    )
  }

  return { byDate: byDate ?? {}, byId }
}

function hasPresentableFlight(facts: DepartureKeyFacts | null): boolean {
  if (!facts) return false
  return (
    publicDepartureLegCardIsPresentable(facts.outbound) ||
    publicDepartureLegCardIsPresentable(facts.inbound)
  )
}

async function auditProduct(p: {
  id: string
  originCode: string
  title: string
  originSource: string
  productType: string | null
  duration: string | null
  airline: string | null
  includedText: string | null
  excludedText: string | null
  optionalToursStructured: string | null
  optionalToursPasteRaw: string | null
  shoppingShopOptions: string | null
  shoppingCount: number | null
  shoppingItems: string | null
  rawMeta: string | null
  flightAdminJson: string | null
  brandKey: string | null
  schedule: string | null
  departures: Array<{
    id: string
    departureDate: Date
    carrierName: string | null
    outboundFlightNo: string | null
    outboundDepartureAirport: string | null
    outboundDepartureAt: Date | null
    outboundArrivalAirport: string | null
    outboundArrivalAt: Date | null
    inboundFlightNo: string | null
    inboundDepartureAirport: string | null
    inboundDepartureAt: Date | null
    inboundArrivalAirport: string | null
    inboundArrivalAt: Date | null
    meetingInfoRaw: string | null
  }>
}): ProductIssue | null {
  const supplier = normalizeSupplierOrigin(p.originSource)
  const issues: IssueCode[] = []
  const detail: Record<string, string | number | boolean> = {}

  const rawParsed = parseProductRawMetaPublic(p.rawMeta ?? null)
  const structured = rawParsed?.structuredSignals
  const flightStructured = (structured?.flightStructured ?? null) as FlightStructuredBody | null

  const adminRaw = getFlightAdminJsonFromRawMeta(p.rawMeta ?? null) ?? p.flightAdminJson ?? null
  const adminProfile = parseFlightAdminJson(adminRaw)
  const flightDisplayPolicy = resolveFlightDisplayPolicy(adminProfile)
  const verygoodRowOnly = p.brandKey === 'verygoodtour'

  const { byDate, byId } = buildPublicFactsByDate(
    adminRaw,
    p.departures,
    flightStructured,
    p.airline,
    flightDisplayPolicy,
    verygoodRowOnly
  )

  if (p.departures.length > 0 && flightDisplayPolicy === 'suppress_no_parsed') {
    issues.push('flight_suppressed')
    detail.flightPolicy = flightDisplayPolicy
  }

  const sortedDeps = [...p.departures].sort(
    (a, b) => a.departureDate.getTime() - b.departureDate.getTime()
  )
  const firstDep = sortedDeps[0]
  const firstDateKey = firstDep
    ? firstDep.departureDate.toISOString().slice(0, 10)
    : null

  let anyPresentable = false
  for (const d of sortedDeps) {
    const dk = d.departureDate.toISOString().slice(0, 10)
    const rawFacts = byId[d.id] ?? byDate[dk] ?? null
    const aligned = alignDepartureKeyFactsToSelectedCalendarDate(rawFacts, dk, {
      packageTotalDays: getProductTotalDays({ duration: p.duration } as never, null),
    })
    if (hasPresentableFlight(aligned)) anyPresentable = true
    if (firstDateKey === dk && aligned && hasPresentableFlight(aligned)) {
      const alignedIso =
        extractIsoDate(aligned.outbound?.departureAtText) ??
        extractIsoDate(aligned.inbound?.departureAtText) ??
        null
      if (alignedIso && alignedIso !== dk) {
        issues.push('flight_calendar_mismatch')
        detail.calendarDate = dk
        detail.flightIsoAfterAlign = alignedIso
        detail.sampleDepartureId = d.id
      }
    }
  }

  if (p.departures.length > 0 && flightDisplayPolicy !== 'suppress_no_parsed' && !anyPresentable) {
    issues.push('flight_no_presentable')
    detail.departureCount = p.departures.length
  }

  const optConsumption = resolveOptionalConsumption(supplier, structured, p.optionalToursStructured)
  const optStructuredValue = optConsumption.value?.trim() ?? ''
  const publicOptRows = getPackageOptionalTourRowsFromProduct(
    optStructuredValue || null,
    p.optionalToursPasteRaw
  )
  const metaOnlyInDb = countMetaOnlyOptionalRows(optStructuredValue || p.optionalToursStructured)
  if (metaOnlyInDb > 0) {
    issues.push('optional_meta_rows_in_db')
    detail.optionalMetaOnlyRows = metaOnlyInDb
    detail.optionalPublicRows = publicOptRows.length
  }
  const hasOptionalSignal =
    Boolean(p.optionalToursPasteRaw?.trim()) ||
    Boolean(optStructuredValue) ||
    metaOnlyInDb > 0
  if (hasOptionalSignal && publicOptRows.length === 0) {
    issues.push('optional_missing_public')
  }

  const shopConsumption = resolveShoppingConsumption(
    supplier,
    structured,
    p.shoppingShopOptions,
    p.optionalToursStructured
  )
  const shopRows = shopConsumption.value ?? []
  const shopPublicCount = shopRows.filter(
    (s) => !s.candidateOnly && (s.itemType?.trim() || s.placeName?.trim() || s.shopName?.trim())
  ).length
  const shoppingPaste =
    typeof structured?.shoppingPasteRaw === 'string' ? structured.shoppingPasteRaw.trim() : ''
  const hasShoppingSignal =
    shopPublicCount > 0 ||
    Boolean(shoppingPaste) ||
    (p.shoppingCount != null && p.shoppingCount > 0) ||
    Boolean(p.shoppingItems?.trim())
  const shoppingItemsComma = p.shoppingItems?.split(/[,，]/).map((s) => s.trim()).filter(Boolean).length ?? 0
  if (hasShoppingSignal && shopPublicCount === 0 && !shoppingPaste && shoppingItemsComma === 0) {
    issues.push('shopping_missing_public')
    detail.shoppingCount = p.shoppingCount ?? 0
  }

  const ie = organizePackageIncludedExcludedForPublicDisplay(
    splitIncludedExcludedForPublicDisplay(p.includedText, p.excludedText)
  )
  if (ie.includedLines.length === 0 && ie.excludedLines.length === 0) {
    issues.push('ie_empty')
  }
  const bracketOnly = ie.includedLines.filter((l) => /^\[[^\]]+\]$/.test(l.trim())).length
  if (bracketOnly >= 2) {
    issues.push('ie_unorganized_brackets')
    detail.bracketOnlyLines = bracketOnly
  }

  if (issues.length === 0) return null

  return {
    id: p.id,
    originCode: p.originCode,
    title: p.title.slice(0, 80),
    supplier,
    productType: p.productType,
    issues,
    detail,
  }
}

async function main() {
  const jsonOut = process.argv.includes('--json')
  const products = await prisma.product.findMany({
    where: { registrationStatus: 'registered' },
    select: {
      id: true,
      originCode: true,
      title: true,
      originSource: true,
      productType: true,
      listingKind: true,
      duration: true,
      airline: true,
      includedText: true,
      excludedText: true,
      optionalToursStructured: true,
      shoppingShopOptions: true,
      shoppingCount: true,
      shoppingItems: true,
      rawMeta: true,
      flightAdminJson: true,
      schedule: true,
      brand: { select: { brandKey: true } },
      departures: {
        orderBy: { departureDate: 'asc' },
        take: 120,
        select: {
          id: true,
          departureDate: true,
          carrierName: true,
          outboundFlightNo: true,
          outboundDepartureAirport: true,
          outboundDepartureAt: true,
          outboundArrivalAirport: true,
          outboundArrivalAt: true,
          inboundFlightNo: true,
          inboundDepartureAirport: true,
          inboundDepartureAt: true,
          inboundArrivalAirport: true,
          inboundArrivalAt: true,
          meetingInfoRaw: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const packageProducts = products.filter((p) => {
    const t = (p.productType ?? 'travel').toLowerCase()
    return PACKAGE_TYPES.has(t) || isAirHotelFreeListing(p.listingKind) || !p.productType
  })
  const airtelLegacyProducts = products.filter(
    (p) => (p.productType ?? '').toLowerCase() === 'airtel' && !isAirHotelFreeListing(p.listingKind)
  )

  const flagged: ProductIssue[] = []
  const flaggedAirtel: ProductIssue[] = []
  for (const p of packageProducts) {
    const row = await auditProduct({
      ...p,
      optionalToursPasteRaw: (() => {
        try {
          const rm = p.rawMeta ? (JSON.parse(p.rawMeta) as { structuredSignals?: { optionalToursPasteRaw?: string } }) : null
          return rm?.structuredSignals?.optionalToursPasteRaw?.trim() ?? null
        } catch {
          return null
        }
      })(),
      brandKey: p.brand?.brandKey ?? null,
    })
    if (row) flagged.push(row)
  }
  for (const p of airtelLegacyProducts) {
    const row = await auditProduct({
      ...p,
      optionalToursPasteRaw: (() => {
        try {
          const rm = p.rawMeta ? (JSON.parse(p.rawMeta) as { structuredSignals?: { optionalToursPasteRaw?: string } }) : null
          return rm?.structuredSignals?.optionalToursPasteRaw?.trim() ?? null
        } catch {
          return null
        }
      })(),
      brandKey: p.brand?.brandKey ?? null,
    })
    if (row) flaggedAirtel.push(row)
  }

  const byIssue: Record<IssueCode, ProductIssue[]> = {
    flight_suppressed: [],
    flight_no_presentable: [],
    flight_calendar_mismatch: [],
    optional_missing_public: [],
    optional_meta_rows_in_db: [],
    shopping_missing_public: [],
    ie_empty: [],
    ie_unorganized_brackets: [],
  }
  for (const f of flagged) {
    for (const code of f.issues) {
      byIssue[code].push(f)
    }
  }

  const summary = {
    auditedAt: new Date().toISOString(),
    totalRegistered: products.length,
    totalPackageAudited: packageProducts.length,
    totalAirtelLegacyAudited: airtelLegacyProducts.length,
    totalWithIssues: flagged.length,
    totalAirtelWithIssues: flaggedAirtel.length,
    cleanCount: packageProducts.length - flagged.length,
    byIssue: Object.fromEntries(
      (Object.keys(byIssue) as IssueCode[]).map((k) => [k, byIssue[k].length])
    ),
    bySupplier: Object.fromEntries(
      (['hanatour', 'modetour', 'verygoodtour', 'ybtour', 'etc'] as OverseasSupplierKey[]).map((s) => [
        s,
        flagged.filter((f) => f.supplier === s).length,
      ])
    ),
  }

  if (jsonOut) {
    console.log(JSON.stringify({ summary, flagged, samples: byIssue }, null, 2))
    return
  }

  console.log('=== 공개 상세 전수 검수 (registered 패키지) ===\n')
  console.log(`검수 대상(패키지·air_hotel_free): ${summary.totalPackageAudited}건`)
  console.log(`검수 대상(airtel 레거시 ItineraryView): ${summary.totalAirtelLegacyAudited}건`)
  console.log(`전체 registered: ${summary.totalRegistered}건`)
  console.log(
    `이슈 — 패키지: ${summary.totalWithIssues}건 / airtel: ${summary.totalAirtelWithIssues}건 · 패키지 정상 추정: ${summary.cleanCount}건\n`
  )

  if (flaggedAirtel.length > 0) {
    console.log('=== airtel 레거시 (ItineraryView) 이슈 상품 ===')
    for (const item of flaggedAirtel) {
      console.log(
        `  · ${item.originCode} | ${item.supplier} | ${item.id} | ${item.issues.join(', ')}`
      )
    }
    console.log('')
  }

  const labels: Record<IssueCode, string> = {
    flight_suppressed: '항공 표시 정책 suppress (가는편/오는편 숨김)',
    flight_no_presentable: '출발행 있으나 표시 가능한 항공 leg 없음',
    flight_calendar_mismatch: '첫 출발일 vs 항공 일시 불일치(정렬 전)',
    optional_missing_public: '옵션 데이터 있으나 공개 표 0행',
    optional_meta_rows_in_db: '옵션 JSON에 소요시간 단독 행 잔존(DB)',
    shopping_missing_public: '쇼핑 신호 있으나 구조화·붙여넣기 모두 없음',
    ie_empty: '포함/불포함 모두 비어 있음',
    ie_unorganized_brackets: '포함란 [카테고리] 헤더만 다수',
  }

  for (const code of Object.keys(byIssue) as IssueCode[]) {
    const list = byIssue[code]
    console.log(`\n## ${labels[code]} — ${list.length}건`)
    for (const item of list.slice(0, 15)) {
      console.log(
        `  · ${item.originCode} | ${item.supplier} | ${item.id} | ${Object.entries(item.detail)
          .slice(0, 3)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')}`
      )
    }
    if (list.length > 15) console.log(`  … 외 ${list.length - 15}건`)
  }

  console.log('\n--- 공급사별 이슈 건수 ---')
  for (const [s, n] of Object.entries(summary.bySupplier)) {
    console.log(`  ${s}: ${n}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
