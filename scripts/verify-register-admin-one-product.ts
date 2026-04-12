/**
 * 실제 DB 상품 1건(최근 수정) 기준: 항공·가격 체인 단계별 스냅샷 + 실본문 fixture 검증.
 *
 *   npx tsx scripts/verify-register-admin-one-product.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import type { Prisma } from '@prisma/client'
import type { ProductPriceRow } from '../app/components/travel/TravelProductDetail'
import { prisma } from '../lib/prisma'
import type { DetailBodyParseSnapshot } from '../lib/detail-body-parser'
import { parseDetailBodyStructuredModetour } from '../lib/detail-body-parser-modetour'
import { parseProductRawMetaPublic } from '../lib/public-product-extras'
import { buildPriceDisplaySsot } from '../lib/price-display-ssot'
import { pickReturnDateCandidateFromRawText } from '../lib/hero-date-utils'
import { extractProductPriceTableByLabels } from '../lib/product-price-table-extract'
import { buildModetourDirectedSegmentLinesFromFlightRaw } from '../lib/flight-modetour-parser'
import {
  mergeProductPriceRowsWithBodyPriceTable,
  productDeparturesToProductPriceRows,
} from '../lib/product-departure-to-price-rows-modetour'
import { getPublicPerPaxUnitKrw } from '../lib/price-utils'
import { buildDepartureKeyFactsMap, enrichDepartureKeyFactsMapForDisplay } from '../lib/departure-key-facts'
import { getFlightAdminJsonFromRawMeta } from '../lib/raw-meta-admin-flight'
import { parseFlightAdminJson, resolveFlightDisplayPolicy, buildKeyFactsFromAdminProfile } from '../lib/admin-flight-profile'

function section(title: string) {
  console.log(`\n=== ${title} ===`)
}

const REAL_BODY_FLIGHT = [
  '1일차 현지 출발: 08:00 관광',
  '중국남방항공',
  '출발 : 인천 2026.07.07(화) 19:20 → 연길 2026.07.07(화) 20:40 CZ6074',
  '도착 : 연길 2026.07.10(금) 10:10 → 인천 2026.07.10(금) 13:25 CZ6073',
].join('\n')

const REAL_BODY_PRICE = `상품가격
- 성인 918,900원
- 아동 Extra Bed 918,900원
- 아동 No Bed 918,900원
- 유아 71,000원`

const REAL_BODY_PRICE_ONE_LINE =
  '성인 918,900원 (유류할증료 89,900원 포함), 아동 Extra Bed 918,900원, 아동 No Bed 918,900원, 유아 71,000원'

/** register-parse.expandModetourFlightRawForDirectedParse 와 동일 판정(스크립트 단독 검증용) */
function repairModetourFlightRawLikeRegister(snap: DetailBodyParseSnapshot): DetailBodyParseSnapshot {
  if (snap.brandKey !== 'modetour') return snap
  const fr = (snap.raw.flightRaw ?? '').trim()
  if (buildModetourDirectedSegmentLinesFromFlightRaw(fr || null)) return snap
  const full = (snap.normalizedRaw ?? '').trim()
  if (full && buildModetourDirectedSegmentLinesFromFlightRaw(full)) {
    return { ...snap, raw: { ...snap.raw, flightRaw: full } }
  }
  return snap
}

function runFixtureAssertions() {
  section('실본문 fixture (DB 없이)')
  const mod = buildModetourDirectedSegmentLinesFromFlightRaw(REAL_BODY_FLIGHT)
  assert.ok(mod?.departureLine?.includes('CZ6074'), '항공: modetour directed 가는편에 편명')
  assert.ok(mod?.returnLine?.includes('CZ6073'), '항공: 오는편에 편명')
  const px = extractProductPriceTableByLabels(REAL_BODY_PRICE)
  assert.ok(px)
  assert.equal(px!.adultPrice, 918_900)
  assert.equal(px!.childExtraBedPrice, 918_900)
  assert.equal(px!.childNoBedPrice, 918_900)
  assert.equal(px!.infantPrice, 71_000)
  const pxOne = extractProductPriceTableByLabels(REAL_BODY_PRICE_ONE_LINE)
  assert.ok(pxOne)
  assert.equal(pxOne!.adultPrice, 918_900)
  assert.equal(pxOne!.childExtraBedPrice, 918_900)
  assert.equal(pxOne!.childNoBedPrice, 918_900)
  assert.equal(pxOne!.infantPrice, 71_000)
  console.log('fixture flight lines:', mod?.departureLine?.slice(0, 80), '…')
  console.log('fixture price table:', px)
  console.log('→ 실본문 fixture: OK')

  section('modetour flightRaw 폴백 (시드 flightRaw만 실패·normalizedRaw는 실본문)')
  const snapBase = parseDetailBodyStructuredModetour({ rawText: REAL_BODY_FLIGHT })
  const broken = {
    ...snapBase,
    raw: { ...snapBase.raw, flightRaw: '유의사항 집합 07:00 미팅' },
  }
  const beforeRepair = buildModetourDirectedSegmentLinesFromFlightRaw(broken.raw.flightRaw ?? null)
  assert.ok(!beforeRepair?.departureLine, '오염 flightRaw로는 directed 실패')
  const snap1 = repairModetourFlightRawLikeRegister(broken)
  const afterRepair = buildModetourDirectedSegmentLinesFromFlightRaw(snap1.raw.flightRaw ?? '')
  assert.ok(afterRepair?.departureLine?.includes('CZ6074'), '폴백 후 가는편 편명')
  assert.ok(afterRepair?.returnLine?.includes('CZ6073'), '폴백 후 오는편 편명')
  console.log('→ modetour flightRaw → normalizedRaw 폴백: OK')

  section('adultVaries + 아동=성인 placeholder 시 본문 4슬롯 merge')
  const table = {
    adultPrice: 918_900,
    childExtraBedPrice: 918_900,
    childNoBedPrice: 918_900,
    infantPrice: 71_000,
  }
  const priceRows: ProductPriceRow[] = [
    {
      id: '1',
      productId: 'p',
      date: '2026-07-07',
      adult: 800_000,
      childBed: 800_000,
      childNoBed: 800_000,
      infant: null,
      priceAdult: 800_000,
      priceChildWithBed: 800_000,
      priceChildNoBed: 800_000,
      priceInfant: null,
      localPrice: null,
      priceGap: 0,
    },
    {
      id: '2',
      productId: 'p',
      date: '2026-07-14',
      adult: 850_000,
      childBed: 850_000,
      childNoBed: 850_000,
      priceInfant: null,
      priceAdult: 850_000,
      priceChildWithBed: 850_000,
      priceChildNoBed: 850_000,
      infant: null,
      localPrice: null,
      priceGap: 0,
    },
  ]
  const mergedPx = mergeProductPriceRowsWithBodyPriceTable(priceRows, table)
  assert.equal(getPublicPerPaxUnitKrw(mergedPx[0]!, 'childBed'), 918_900)
  assert.equal(getPublicPerPaxUnitKrw(mergedPx[0]!, 'childNoBed'), 918_900)
  assert.equal(getPublicPerPaxUnitKrw(mergedPx[0]!, 'infant'), 71_000)
  console.log('→ 가격 merge (adultVaries·placeholder): OK')
}

// 문맥 가중: 중간 일정일보다 "귀국 + 인천 도착" 줄의 날짜를 택해야 함
const sampleBlob =
  '가는편 2026.07.07(월) 출발\n' +
  '2일차 2026.07.08 관광\n' +
  '귀국 2026.07.10(목) 인천국제공항 도착 13:25'
assert.equal(pickReturnDateCandidateFromRawText(sampleBlob, '2026-07-07'), '2026-07-10')

const sampleLastFallback = '일정1 2026-05-01\n' + '일정2 2026-05-02\n' + '일정3 2026-05-04'
assert.equal(pickReturnDateCandidateFromRawText(sampleLastFallback, '2026-05-01'), '2026-05-04')

type ProductVerifyRow = Prisma.ProductGetPayload<{
  include: {
    prices: true
    departures: true
    brand: { select: { brandKey: true } }
  }
}>

function legSummary(f: { outbound: unknown; inbound: unknown } | null | undefined): string {
  if (!f) return '(null)'
  const o = f.outbound && typeof f.outbound === 'object' ? JSON.stringify(f.outbound).slice(0, 120) : ''
  const i = f.inbound && typeof f.inbound === 'object' ? JSON.stringify(f.inbound).slice(0, 120) : ''
  return `ob:${o} ib:${i}`
}

function firstFlightGap(args: {
  flightRaw: string | null | undefined
  flightStructured: Record<string, unknown> | null | undefined
  brandKey: string | null | undefined
  firstDep: ProductVerifyRow['departures'][0] | undefined
  departureKeyFacts: Record<string, import('../lib/departure-key-facts').DepartureKeyFacts> | undefined
  firstDateKey: string | null
}): { step: number; note: string; snapshot: Record<string, unknown> } {
  const { flightRaw, flightStructured, brandKey, firstDep, departureKeyFacts, firstDateKey } = args
  const fr = (flightRaw ?? '').trim()
  if (!fr) {
    return { step: 2, note: 'detailBody/rawMeta flightRaw 비어 있음', snapshot: { flightRawLen: 0 } }
  }
  const mod =
    brandKey === 'modetour' ? buildModetourDirectedSegmentLinesFromFlightRaw(flightRaw) : null
  const topDep = typeof flightStructured?.departureSegmentText === 'string' ? flightStructured.departureSegmentText.trim() : ''
  const topRet = typeof flightStructured?.returnSegmentText === 'string' ? flightStructured.returnSegmentText.trim() : ''
  if (
    brandKey === 'modetour' &&
    (!mod?.departureLine?.trim() || !mod?.returnLine?.trim()) &&
    !topDep &&
    !topRet
  ) {
    return {
      step: 3,
      note: 'modetour directed 실패·flightStructured 세그먼트도 비어 있음',
      snapshot: { flightRawPreview: fr.slice(0, 200), modetourSeg: mod },
    }
  }
  if (firstDep) {
    const hasDepFlight =
      Boolean(firstDep.outboundFlightNo?.trim()) ||
      Boolean(firstDep.inboundFlightNo?.trim()) ||
      Boolean(firstDep.outboundDepartureAirport?.trim())
    if (!hasDepFlight) {
      /* departure 행 비어 있어도 raw+structured로 공개 보강 가능 → 4단계는 정보용 */
    }
  }
  const fk = firstDateKey && departureKeyFacts ? departureKeyFacts[firstDateKey] : null
  const obCard = fk?.outbound && typeof fk.outbound === 'object' ? (fk.outbound as { flightNo?: string }).flightNo : null
  const ibCard = fk?.inbound && typeof fk.inbound === 'object' ? (fk.inbound as { flightNo?: string }).flightNo : null
  const hasUsableCard = Boolean(obCard?.trim() || ibCard?.trim() || fk?.outboundSummary?.trim() || fk?.inboundSummary?.trim())
  if (!hasUsableCard && !topDep && !topRet && !mod?.departureLine) {
    return {
      step: 5,
      note: 'departureKeyFacts에 항공 다리/요약 없음',
      snapshot: { firstDateKey, facts: fk },
    }
  }
  if (!hasUsableCard && (topDep || topRet || mod?.departureLine)) {
    return {
      step: 6,
      note: 'structured/modetour 줄은 있으나 카드용 facts가 비어 있음(조립/정책 확인)',
      snapshot: { firstDateKey, mod, topDep, topRet },
    }
  }
  return { step: 0, note: '항공 체인에 표시 가능한 값 존재', snapshot: { firstDateKey, mod, topDep } }
}

function firstPriceGap(args: {
  priceTableRaw: string | null | undefined
  productPriceTable: Record<string, unknown> | null | undefined
  departures: ProductVerifyRow['departures']
  mergedRows: ReturnType<typeof productDeparturesToProductPriceRows>
}): { step: number; note: string; snapshot: Record<string, unknown> } {
  const { priceTableRaw, productPriceTable, departures, mergedRows } = args
  const raw = (priceTableRaw ?? '').trim()
  const extracted = raw ? extractProductPriceTableByLabels(raw) : null
  const tableFromMeta = productPriceTable
    ? {
        adultPrice: typeof productPriceTable.adultPrice === 'number' ? productPriceTable.adultPrice : null,
        childExtraBedPrice:
          typeof productPriceTable.childExtraBedPrice === 'number' ? productPriceTable.childExtraBedPrice : null,
        childNoBedPrice:
          typeof productPriceTable.childNoBedPrice === 'number' ? productPriceTable.childNoBedPrice : null,
        infantPrice: typeof productPriceTable.infantPrice === 'number' ? productPriceTable.infantPrice : null,
      }
    : null

  if (!raw && !tableFromMeta?.adultPrice && !tableFromMeta?.childExtraBedPrice) {
    return { step: 1, note: '가격표 원문·productPriceTable 모두 비어 있음', snapshot: {} }
  }

  const ex2 = extractProductPriceTableByLabels(raw || '')
  const slotsOk =
    ex2 &&
    ex2.adultPrice != null &&
    ex2.childExtraBedPrice != null &&
    ex2.childNoBedPrice != null &&
    ex2.infantPrice != null
  if (raw && !slotsOk) {
    return {
      step: 2,
      note: '라벨 추출기로 4슬롯 미충족',
      snapshot: { extract: ex2, rawPreview: raw.slice(0, 400) },
    }
  }

  const first = departures[0]
  if (first) {
    const dIso =
      first.departureDate instanceof Date
        ? first.departureDate.toISOString().slice(0, 10)
        : String(first.departureDate).slice(0, 10)
    const row = mergedRows.find((r) => r.date === dIso)
    if (row) {
      const missChild =
        getPublicPerPaxUnitKrw(row, 'childBed') == null ||
        getPublicPerPaxUnitKrw(row, 'childNoBed') == null ||
        getPublicPerPaxUnitKrw(row, 'infant') == null
      if (missChild) {
        return {
          step: 5,
          note: 'merge 후 공개 행에 아동/유아 단가 누락',
          snapshot: {
            date: dIso,
            row,
            productPriceTable: tableFromMeta,
          },
        }
      }
    }
  }

  return {
    step: 0,
    note: '가격 4슬롯·공개 행 단가 확인됨',
    snapshot: { extract: ex2, tableFromMeta, firstRow: mergedRows[0] },
  }
}

async function main() {
  runFixtureAssertions()

  section('휴리스틱 샘플')
  console.log('pickReturnDateCandidateFromRawText 귀국/마지막일 폴백: OK')

  section('DB 1건 (최근 수정 상품)')
  let product: ProductVerifyRow | null
  try {
    product = await prisma.product.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        prices: { orderBy: { date: 'asc' }, take: 10 },
        departures: { orderBy: { departureDate: 'asc' }, take: 20 },
        brand: { select: { brandKey: true } },
      },
    })
  } catch (e) {
    console.log('Prisma 연결 실패 — .env DATABASE_URL 확인:', e instanceof Error ? e.message : e)
    process.exit(0)
    return
  }

  if (!product) {
    console.log('DB에 Product 없음 — fixture만 완료.')
    await prisma.$disconnect()
    process.exit(0)
    return
  }

  console.log('productId:', product.id)
  console.log('title:', product.title?.slice(0, 60))
  const brandKey = product.brand?.brandKey ?? null

  const rawParsed = parseProductRawMetaPublic(product.rawMeta ?? null)
  const structured = rawParsed?.structuredSignals
  const flightRaw = structured?.flightRaw ?? null
  const structuredLoose = structured as Record<string, unknown> | null | undefined
  const flightStructured = structuredLoose?.flightStructured as Record<string, unknown> | null | undefined

  const adminFlightRaw = getFlightAdminJsonFromRawMeta(product.rawMeta ?? null)
  const adminProfile = parseFlightAdminJson(adminFlightRaw)
  const flightDisplayPolicy = resolveFlightDisplayPolicy(adminProfile)

  const modSeg =
    brandKey === 'modetour' ? buildModetourDirectedSegmentLinesFromFlightRaw(flightRaw ?? null) : null
  const flightStructuredForPage =
    structured && structured !== null
      ? {
          airlineName: structured.airlineName ?? null,
          departureSegmentText: modSeg?.departureLine ?? structured.departureSegmentText ?? null,
          returnSegmentText: modSeg?.returnLine ?? structured.returnSegmentText ?? null,
          routeRaw: structured.routeRaw ?? null,
          outboundFlightNo: structured.outboundFlightNo ?? null,
          inboundFlightNo: structured.inboundFlightNo ?? null,
          departureDateTimeRaw: structured.departureDateTimeRaw ?? null,
          arrivalDateTimeRaw: structured.arrivalDateTimeRaw ?? null,
          useModetourStructuredFlightLegs: brandKey === 'modetour',
        }
      : null

  const departures = product.departures ?? []
  const baseFactsByDate = departures.length > 0 ? buildDepartureKeyFactsMap(departures) : {}
  const parsedFactsByDate =
    departures.length > 0
      ? enrichDepartureKeyFactsMapForDisplay(baseFactsByDate, flightStructuredForPage, product.airline ?? null)
      : undefined
  const adminFactsTemplate =
    adminProfile != null ? buildKeyFactsFromAdminProfile(adminProfile, product.airline ?? null) : null
  const departureKeyFactsByDate =
    departures.length === 0
      ? undefined
      : flightDisplayPolicy === 'admin_only' && adminFactsTemplate != null
        ? Object.fromEntries(
            Object.keys(baseFactsByDate).map((dateKey) => [
              dateKey,
              {
                ...adminFactsTemplate,
                meetingSummary: baseFactsByDate[dateKey]?.meetingSummary ?? null,
              },
            ])
          )
        : parsedFactsByDate

  const firstDep = departures[0]
  const firstDateKey = firstDep
    ? firstDep.departureDate instanceof Date
      ? firstDep.departureDate.toISOString().slice(0, 10)
      : String(firstDep.departureDate).slice(0, 10)
    : null

  section('항공 체인 스냅샷')
  console.log('1) airlineTransport: (DB 미저장) — 미리보기 요청 pastedBlocks만 해당')
  console.log('2) structuredSignals.flightRaw len:', (flightRaw ?? '').length, 'preview:', (flightRaw ?? '').slice(0, 160))
  console.log('3) flightStructured debug.status:', (flightStructured as { debug?: { status?: string } } | undefined)?.debug?.status ?? '(n/a)')
  console.log('   modetour directed:', modSeg)
  console.log('4) 첫 ProductDeparture 항공:', firstDep
    ? {
        outboundFlightNo: firstDep.outboundFlightNo,
        inboundFlightNo: firstDep.inboundFlightNo,
        outboundDepartureAirport: firstDep.outboundDepartureAirport,
      }
    : '(없음)')
  console.log('   flightDisplayPolicy:', flightDisplayPolicy)
  const fk0 = firstDateKey && departureKeyFactsByDate ? departureKeyFactsByDate[firstDateKey] : null
  console.log('5) 첫 출발일 departureKeyFacts:', legSummary(fk0))
  console.log('6) TravelCoreInfoSection용 facts와 동일(위 5와 동일)')

  const fg = firstFlightGap({
    flightRaw,
    flightStructured: flightStructured ?? null,
    brandKey,
    firstDep,
    departureKeyFacts: departureKeyFactsByDate,
    firstDateKey,
  })
  console.log('\n>>> 항공 판정: 최초 문제 단계 =', fg.step || '(없음/추정 불필요)', '|', fg.note)
  console.log('    스냅샷:', JSON.stringify(fg.snapshot, null, 2).slice(0, 800))

  section('가격 체인 스냅샷')
  const priceRowsBase = productDeparturesToProductPriceRows(departures)
  const ppt = structured?.productPriceTable as Record<string, unknown> | null | undefined
  const mergedPriceRows = mergeProductPriceRowsWithBodyPriceTable(priceRowsBase, ppt ?? null)

  console.log('1) priceTableRawText len:', (structured?.priceTableRawText ?? '').length)
  console.log('2) extractProductPriceTableByLabels(raw):', extractProductPriceTableByLabels(structured?.priceTableRawText ?? ''))
  console.log('3) structuredSignals.productPriceTable:', ppt ?? null)
  console.log('4) 첫 ProductDeparture 가격:', firstDep
    ? {
        adultPrice: firstDep.adultPrice,
        childBedPrice: firstDep.childBedPrice,
        childNoBedPrice: firstDep.childNoBedPrice,
        infantPrice: firstDep.infantPrice,
      }
    : '(없음)')
  console.log('5) merge 후 첫 공개 행:', mergedPriceRows[0] ?? '(없음)')
  const r0 = mergedPriceRows[0]
  if (r0) {
    console.log('6) ProductLiveQuoteCard 단가:', {
      adult: getPublicPerPaxUnitKrw(r0, 'adult'),
      childBed: getPublicPerPaxUnitKrw(r0, 'childBed'),
      childNoBed: getPublicPerPaxUnitKrw(r0, 'childNoBed'),
      infant: getPublicPerPaxUnitKrw(r0, 'infant'),
    })
  }

  const pg = firstPriceGap({
    priceTableRaw: structured?.priceTableRawText ?? null,
    productPriceTable: ppt ?? null,
    departures,
    mergedRows: mergedPriceRows,
  })
  console.log('\n>>> 가격 판정: 최초 문제 단계 =', pg.step || '(없음)', '|', pg.note)
  console.log('    스냅샷:', JSON.stringify(pg.snapshot, null, 2).slice(0, 800))

  section('기존: 선택관광·쇼핑·달력 샘플 (참고)')
  const p0 = product.prices[0]
  const promo = rawParsed?.pricePromotion?.merged ?? null
  if (p0) {
    const ssot0 = buildPriceDisplaySsot(p0.adult, promo)
    console.log('첫 날짜 adult:', p0.adult, '→ selectedDeparturePrice:', ssot0.selectedDeparturePrice)
  }
  const dep = product.departures[0]
  if (dep) {
    const depIso =
      dep.departureDate instanceof Date
        ? dep.departureDate.toISOString().slice(0, 10)
        : String(dep.departureDate).slice(0, 10)
    const rawFlight = [
      structured?.arrivalDateTimeRaw,
      structured?.departureDateTimeRaw,
      structured?.routeRaw,
      structured?.returnSegmentText,
    ]
      .filter((x): x is string => typeof x === 'string' && x.trim() !== '')
      .join('\n')
    const candidate = pickReturnDateCandidateFromRawText(rawFlight, depIso)
    console.log('귀국 후보:', candidate ?? '(없음)')
  }

  await prisma.$disconnect()
  console.log('\n검증 출력 완료.')
}

main().catch(async (e) => {
  console.error(e)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
