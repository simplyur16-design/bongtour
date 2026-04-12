/**
 * 실패 확인 상품(고정 ID) 기준: 공개 상세와 동일한 항공·가격 체인 출력.
 *
 *   npx tsx scripts/verify-failure-product-chain.ts
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import { formatDirectedFlightRow } from '../lib/flight-user-display'
import { parseProductRawMetaPublic } from '../lib/public-product-extras'
import {
  buildModetourDirectedDisplayFromStructuredBody,
  buildModetourDirectedSegmentLinesFromFlightRaw,
} from '../lib/flight-modetour-parser'
import { extractProductPriceTableByLabels, mergeProductPriceTableWithLabelExtract } from '../lib/product-price-table-extract'
import {
  mergeProductPriceRowsWithBodyPriceTable,
  productDeparturesToProductPriceRows,
} from '../lib/product-departure-to-price-rows-modetour'
import { parsedPricesToDepartureInputs } from '../lib/upsert-product-departures-hanatour'
import { getPublicPerPaxUnitKrw } from '../lib/price-utils'
import { buildDepartureKeyFactsMap, enrichDepartureKeyFactsMapForDisplay } from '../lib/departure-key-facts'
import { getFlightAdminJsonFromRawMeta } from '../lib/raw-meta-admin-flight'
import { parseFlightAdminJson, resolveFlightDisplayPolicy, buildKeyFactsFromAdminProfile } from '../lib/admin-flight-profile'

/** 이전 로그에서 확인된 동일 실패 상품 (연길 CZ 직항) */
const TARGET_PRODUCT_ID = 'cmna9k2pu0098ggsefm9b8q6f'

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

async function main() {
  const product = await prisma.product.findUnique({
    where: { id: TARGET_PRODUCT_ID },
    include: {
      brand: { select: { brandKey: true } },
      departures: { orderBy: { departureDate: 'asc' } },
      prices: { orderBy: { date: 'asc' }, take: 30 },
    },
  })
  if (!product) {
    console.error('TARGET_PRODUCT_ID 없음:', TARGET_PRODUCT_ID)
    process.exit(1)
  }

  const brandKey = product.brand?.brandKey ?? null
  const rawParsed = parseProductRawMetaPublic(product.rawMeta ?? null)
  const structured = rawParsed?.structuredSignals
  const flightDbgSk = (() => {
    const fs = (structured as Record<string, unknown> | null | undefined)?.flightStructured
    if (!fs || typeof fs !== 'object' || Array.isArray(fs)) return null
    const dbg = (fs as { debug?: { supplierBrandKey?: unknown } }).debug
    return dbg && typeof dbg === 'object' && !Array.isArray(dbg)
      ? (dbg as { supplierBrandKey?: string }).supplierBrandKey
      : null
  })()
  const useModetourPriceMerge = brandKey === 'modetour' || flightDbgSk === 'modetour'
  const sAny = structured as Record<string, unknown> | null | undefined
  const detailBodyNormalizedRaw =
    typeof sAny?.detailBodyNormalizedRaw === 'string' ? sAny.detailBodyNormalizedRaw : null
  const flightRaw = structured?.flightRaw ?? null
  const airlineTransportNote = '(DB 미저장 — pastedBlocks.airlineTransport 는 미리보기 전용)'

  console.log('\n========== 검증 대상 ==========')
  console.log('productId:', product.id)
  console.log('title:', product.title)
  console.log('brandKey:', brandKey)
  console.log('출발일 샘플:', product.departures.slice(0, 4).map((d) => iso(d.departureDate)))

  // ----- 항공 6단계 -----
  console.log('\n========== 항공 체인 (1~6) ==========')
  console.log('1) airlineTransport:', airlineTransportNote)

  console.log('2) 저장 flightRaw len:', (flightRaw ?? '').length)
  console.log('   preview:', (flightRaw ?? '').slice(0, 200).replace(/\n/g, '\\n'))
  console.log('   detailBodyNormalizedRaw len:', (detailBodyNormalizedRaw ?? '').length)
  console.log('   normalized 에 CZ6074:', /CZ6074/.test(String(detailBodyNormalizedRaw ?? '')))
  const fs = sAny?.flightStructured as Record<string, unknown> | undefined
  const dbgSk = (fs?.debug as { supplierBrandKey?: string } | undefined)?.supplierBrandKey
  const useModetourDirected = brandKey === 'modetour' || dbgSk === 'modetour'
  const segOld = useModetourDirected ? buildModetourDirectedSegmentLinesFromFlightRaw(flightRaw) : null
  const segNew = useModetourDirected
    ? buildModetourDirectedDisplayFromStructuredBody(flightRaw, detailBodyNormalizedRaw)
    : null

  console.log('3) flightStructured (rawMeta) airlineName=', structured?.airlineName ?? null)
  console.log('   flightStructured.debug:', (fs?.debug as Record<string, unknown>) ?? null)
  console.log('   useModetourDirected (brandKey|debug):', useModetourDirected, { brandKey, dbgSk })
  console.log(
    '4) DB ProductDeparture 첫 행 항공 필드:',
    product.departures[0]
      ? {
          date: iso(product.departures[0].departureDate),
          outboundFlightNo: product.departures[0].outboundFlightNo,
          inboundFlightNo: product.departures[0].inboundFlightNo,
          outboundDepartureAirport: product.departures[0].outboundDepartureAirport,
        }
      : null
  )

  const adminProfile = parseFlightAdminJson(getFlightAdminJsonFromRawMeta(product.rawMeta ?? null))
  const flightDisplayPolicy = resolveFlightDisplayPolicy(adminProfile)
  const flightStructuredForPage =
    structured != null
      ? {
          airlineName: segNew?.airlineName ?? structured.airlineName ?? null,
          departureSegmentText: segNew?.departureLine ?? structured.departureSegmentText ?? null,
          returnSegmentText: segNew?.returnLine ?? structured.returnSegmentText ?? null,
          routeRaw: structured.routeRaw ?? null,
          flightRaw: structured.flightRaw ?? null,
          detailBodyNormalizedRaw: detailBodyNormalizedRaw,
          outboundFlightNo: structured.outboundFlightNo ?? null,
          inboundFlightNo: structured.inboundFlightNo ?? null,
          departureDateTimeRaw: structured.departureDateTimeRaw ?? null,
          arrivalDateTimeRaw: structured.arrivalDateTimeRaw ?? null,
          useModetourStructuredFlightLegs: useModetourDirected,
        }
      : null

  const baseFacts = buildDepartureKeyFactsMap(product.departures)
  const firstKey = product.departures[0] ? iso(product.departures[0].departureDate) : null
  const parsedFacts =
    product.departures.length > 0
      ? enrichDepartureKeyFactsMapForDisplay(baseFacts, flightStructuredForPage, product.airline ?? null)
      : undefined
  const adminFactsTemplate =
    adminProfile != null ? buildKeyFactsFromAdminProfile(adminProfile, product.airline ?? null) : null
  const departureKeyFactsByDate =
    product.departures.length === 0
      ? undefined
      : flightDisplayPolicy === 'admin_only' && adminFactsTemplate != null
        ? Object.fromEntries(
            Object.keys(baseFacts).map((k) => [
              k,
              { ...adminFactsTemplate, meetingSummary: baseFacts[k]?.meetingSummary ?? null },
            ])
          )
        : parsedFacts

  console.log('5) departureKeyFactsByDate[첫 출발일]:', firstKey ? JSON.stringify(departureKeyFactsByDate?.[firstKey])?.slice(0, 500) : null)
  console.log('   flightDisplayPolicy:', flightDisplayPolicy)
  console.log('   modetour directed (flightRaw만):', segOld)
  console.log(
    '   modetour directed (flightRaw + normalized 폴백):',
    segNew
      ? { airlineName: segNew.airlineName, departureLine: segNew.departureLine?.slice(0, 120), returnLine: segNew.returnLine?.slice(0, 120) }
      : null
  )

  const finalAirline = flightStructuredForPage?.airlineName ?? product.airline ?? ''
  const outText = JSON.stringify(departureKeyFactsByDate?.[firstKey!]?.outbound ?? {})
  const inText = JSON.stringify(departureKeyFactsByDate?.[firstKey!]?.inbound ?? {})
  const obSum = departureKeyFactsByDate?.[firstKey!]?.outboundSummary ?? ''
  const ibSum = departureKeyFactsByDate?.[firstKey!]?.inboundSummary ?? ''
  const fk0 = firstKey ? departureKeyFactsByDate?.[firstKey] : null
  const obLeg = fk0?.outbound
  const ibLeg = fk0?.inbound
  console.log('\n--- departureKeyFactsByDate[첫 출발일] leg 카드 (출·도착 일시 4슬롯) ---')
  console.log(
    JSON.stringify(
      {
        가는편_출발_날짜시간: obLeg?.departureAtText ?? null,
        가는편_도착_날짜시간: obLeg?.arrivalAtText ?? null,
        오는편_출발_날짜시간: ibLeg?.departureAtText ?? null,
        오는편_도착_날짜시간: ibLeg?.arrivalAtText ?? null,
        가는편_공항: { 출발: obLeg?.departureAirport, 도착: obLeg?.arrivalAirport },
        오는편_공항: { 출발: ibLeg?.departureAirport, 도착: ibLeg?.arrivalAirport },
        편명: { 가는편: obLeg?.flightNo, 오는편: ibLeg?.flightNo },
      },
      null,
      2
    )
  )
  const outUi = formatDirectedFlightRow('가는편', obLeg)
  const inUi = formatDirectedFlightRow('오는편', ibLeg)
  console.log('\n--- 공개 상세 TravelCoreInfoSection 동일 포맷(항공여정 문구) ---')
  console.log('   ', outUi.line)
  console.log('   ', inUi.line)

  console.log('\n6) 공개 조립 최종(첫 출발일) 요약 필드:')
  console.log('   airline:', finalAirline)
  console.log('   outboundSummary:', obSum.slice(0, 200))
  console.log('   inboundSummary:', ibSum.slice(0, 200))

  const tHas = (s: string | null | undefined, sub: string) => Boolean(s && s.replace(/\s+/g, '').includes(sub.replace(/\s+/g, '')))
  const fourOk =
    tHas(obLeg?.departureAtText, '2026.07.07') &&
    tHas(obLeg?.departureAtText, '19:20') &&
    tHas(obLeg?.arrivalAtText, '2026.07.07') &&
    tHas(obLeg?.arrivalAtText, '20:40') &&
    tHas(ibLeg?.departureAtText, '2026.07.10') &&
    tHas(ibLeg?.departureAtText, '10:10') &&
    tHas(ibLeg?.arrivalAtText, '2026.07.10') &&
    tHas(ibLeg?.arrivalAtText, '13:25')
  const uiOk =
    tHas(outUi.line, '19:20') &&
    tHas(outUi.line, '20:40') &&
    tHas(inUi.line, '10:10') &&
    tHas(inUi.line, '13:25')
  assert.ok(fourOk, 'leg 카드 4슬롯(날짜·시각) 누락 — 항공 미통과')
  assert.ok(uiOk, '공개 항공여정 문구에 가는/오는 출·도착 시각 미포함 — 항공 미통과')
  console.log('\n>>> 출·도착 일시 4슬롯 + 공개 문구 검증: OK')

  const hzOk = (v: string | null | undefined) => Boolean(v && /중국남방항공/.test(v))
  const czOk = (v: string | null | undefined, n: string) => Boolean(v && v.includes(n))
  const c74 =
    czOk(segNew?.departureLine, 'CZ6074') ||
    czOk(outText + obSum, 'CZ6074') ||
    czOk(structured?.departureSegmentText, 'CZ6074')
  const c73 =
    czOk(segNew?.returnLine, 'CZ6073') ||
    czOk(inText + ibSum, 'CZ6073') ||
    czOk(structured?.returnSegmentText, 'CZ6073')

  let firstAirGap = 0
  if (!String(flightRaw ?? '').trim()) firstAirGap = 2
  else if (useModetourDirected && !segNew?.departureLine) firstAirGap = 3
  else if (!c74 || !c73) firstAirGap = 6

  const dateKeys = product.departures.slice(0, 3).map((d) => iso(d.departureDate))
  console.log(
    '   날짜 전환(최대 3개 출발일) CZ6074 in outboundSummary:',
    dateKeys.map((k) => (czOk(departureKeyFactsByDate?.[k]?.outboundSummary, 'CZ6074') ? 'Y' : 'N'))
  )
  console.log(
    '   날짜 전환 CZ6073 in inboundSummary:',
    dateKeys.map((k) => (czOk(departureKeyFactsByDate?.[k]?.inboundSummary, 'CZ6073') ? 'Y' : 'N'))
  )

  console.log('\n>>> 항공 자동 판정 (폴백 반영 segNew 기준)')
  console.log(
    '   중국남방항공 흔적:',
    hzOk(finalAirline) || hzOk(structured?.airlineName ?? null) || hzOk(segNew?.airlineName) ? 'Y' : 'N'
  )
  console.log('   CZ6074:', c74 ? 'Y' : 'N')
  console.log('   CZ6073:', c73 ? 'Y' : 'N')
  console.log('   최초 의심 단계(2=flightRaw 비어, 3=directed 전부 실패, 6=최종 노출 실패):', firstAirGap || '0=통과')

  // ----- 가격 6단계 -----
  console.log('\n========== 가격 체인 (1~6) ==========')
  const priceTableRaw = structured?.priceTableRawText ?? ''
  console.log('1) priceTableRawText len:', priceTableRaw.length, 'preview:', priceTableRaw.slice(0, 160))
  const ex = extractProductPriceTableByLabels(priceTableRaw)
  console.log('2) extractProductPriceTableByLabels(raw):', ex)
  const sampleParsedPrices = product.prices.slice(0, 3).map((p) => ({
    date: iso(p.date),
    adultBase: p.adult,
    adultFuel: 0,
    childBedBase: p.childBed,
    childNoBedBase: p.childNoBed,
    childFuel: 0,
    infantBase: p.infant,
    infantFuel: 0,
    status: '예약가능' as const,
    availableSeats: 0,
  }))
  const depInputs = parsedPricesToDepartureInputs(sampleParsedPrices)
  console.log('3) parsedPricesToDepartureInputs(레거시 ProductPrice→입력 샘플):', depInputs.slice(0, 2))
  console.log(
    '4) DB ProductDeparture (앞 4행) adult/cb/cnb/inf:',
    product.departures.slice(0, 4).map((d) => ({
      date: iso(d.departureDate),
      adult: d.adultPrice,
      cb: d.childBedPrice,
      cnb: d.childNoBedPrice,
      inf: d.infantPrice,
    }))
  )
  const rowsBase = productDeparturesToProductPriceRows(product.departures)
  const labelEx =
    useModetourPriceMerge && priceTableRaw.trim()
      ? extractProductPriceTableByLabels(priceTableRaw)
      : null
  const ppt = useModetourPriceMerge
    ? mergeProductPriceTableWithLabelExtract(structured?.productPriceTable ?? null, labelEx) ??
      structured?.productPriceTable ??
      null
    : structured?.productPriceTable ?? null
  const merged = mergeProductPriceRowsWithBodyPriceTable(
    rowsBase,
    ppt,
    useModetourPriceMerge ? { modetourVaryingAdultChildLinkage: true } : undefined
  )
  console.log('5) merge 후 공개 행 (앞 4):')
  for (const r of merged.slice(0, 4)) {
    console.log('  ', r.date, {
      adult: getPublicPerPaxUnitKrw(r, 'adult'),
      childBed: getPublicPerPaxUnitKrw(r, 'childBed'),
      childNoBed: getPublicPerPaxUnitKrw(r, 'childNoBed'),
      infant: getPublicPerPaxUnitKrw(r, 'infant'),
    })
  }
  console.log('6) ProductLiveQuoteCard 동일 단가(행별): 위 5와 동일')

  let firstPriceGap = 0
  if (!ex && !ppt?.adultPrice && !ppt?.childExtraBedPrice) firstPriceGap = 2
  else {
    for (const r of merged.slice(0, 6)) {
      if (
        getPublicPerPaxUnitKrw(r, 'childBed') == null ||
        getPublicPerPaxUnitKrw(r, 'childNoBed') == null ||
        getPublicPerPaxUnitKrw(r, 'infant') == null
      ) {
        firstPriceGap = 5
        break
      }
    }
  }

  const adultsDistinct = new Set(merged.slice(0, 8).map((r) => getPublicPerPaxUnitKrw(r, 'adult'))).size
  const bedsDistinct = new Set(merged.slice(0, 8).map((r) => getPublicPerPaxUnitKrw(r, 'childBed'))).size
  console.log('\n>>> 가격 판정')
  console.log('   앞 8행 성인가 서로 다른 값 개수:', adultsDistinct, '(날짜별 추종 확인용)')
  console.log('   앞 8행 아동침대가 서로 다른 값 개수:', bedsDistinct)
  console.log('   최초 의심 단계:', firstPriceGap || '0=통과')
  console.log('   modetour 가격 병합 컨텍스트:', useModetourPriceMerge ? 'Y' : 'N')

  if (useModetourPriceMerge && adultsDistinct > 1) {
    for (const r of merged.slice(0, 8)) {
      const ad = getPublicPerPaxUnitKrw(r, 'adult')
      const cb = getPublicPerPaxUnitKrw(r, 'childBed')
      const cnb = getPublicPerPaxUnitKrw(r, 'childNoBed')
      const inf = getPublicPerPaxUnitKrw(r, 'infant')
      if (ad != null && ad > 0) {
        assert.equal(cb, ad, `modetour: ${r.date} 아동 Extra Bed가 성인가와 동일해야 함`)
        assert.equal(cnb, ad, `modetour: ${r.date} 아동 No Bed가 성인가와 동일해야 함`)
      }
      assert.ok(inf != null && inf > 0, `modetour: ${r.date} 유아 단가 누락`)
    }
    assert.equal(
      bedsDistinct,
      adultsDistinct,
      'modetour: 아동침대가 성인과 같은 날짜 분포를 따라야 함'
    )
  }

  await prisma.$disconnect()
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
