/**
 * 공급사 3개(verygoodtour / modetour / ybtour) DB 실측: FMC·모듈키·structuredSignals·쇼핑/옵션 resolution·모두투어 가격 merge.
 * 공개 상세 `app/products/[id]/page.tsx`와 동일 입력으로 shopping/optional resolution을 재현한다.
 *
 * 출력의 `brandKey` / `resolvePublicConsumptionModuleKey`는 **canonical supplier key** 기준.
 * `yellowballoon` 구간은 **DB에 과거 brand 행이 남아 있는지 읽기 전용 점검**이며, 신규 API 입력 예시가 아니다.
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 *
 *   npx tsx scripts/verify-supplier-pipeline-alignment.ts
 */
import assert from 'node:assert/strict'
import { prisma } from '../lib/prisma'
import {
  parseProductRawMetaPublic,
  parseShoppingStopsJson,
} from '../lib/public-product-extras'
import { resolvePublicConsumptionModuleKey } from '../lib/resolve-public-consumption-module-key'
import * as flightManualModetour from '../lib/flight-manual-correction-modetour'
import * as flightManualVerygoodtour from '../lib/flight-manual-correction-verygoodtour'
import * as flightManualYbtour from '../lib/flight-manual-correction-ybtour'
import * as flightManualHanatour from '../lib/flight-manual-correction-hanatour'
import { extractProductPriceTableByLabels, mergeProductPriceTableWithLabelExtract } from '../lib/product-price-table-extract'
import {
  mergeProductPriceRowsWithBodyPriceTable,
  productDeparturesToProductPriceRows,
} from '../lib/product-departure-to-price-rows-modetour'
import { getPublicPerPaxUnitKrw } from '../lib/price-utils'
import * as publicConsumptionHanatour from '../lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '../lib/public-consumption-modetour'
import * as publicConsumptionVerygood from '../lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '../lib/public-consumption-ybtour'

function pickFlightManualModule(brandKey: string | null | undefined, originSource: string | null | undefined) {
  switch (resolvePublicConsumptionModuleKey(brandKey, originSource)) {
    case 'modetour':
      return flightManualModetour
    case 'verygoodtour':
      return flightManualVerygoodtour
    case 'ybtour':
      return flightManualYbtour
    default:
      return flightManualHanatour
  }
}

function stableJson(v: unknown): string {
  return JSON.stringify(v, Object.keys(v as object).sort())
}

type BrandRow = { brandKey: string }

async function oneProduct(brandKey: string) {
  const brand = await prisma.brand.findFirst({ where: { brandKey } as { brandKey: string } })
  if (!brand) return null
  return prisma.product.findFirst({
    where: { brandId: brand.id, registrationStatus: 'registered' },
    orderBy: { updatedAt: 'desc' },
    include: {
      prices: { orderBy: { date: 'asc' }, take: 8 },
      departures: { orderBy: { departureDate: 'asc' }, take: 8 },
      brand: { select: { brandKey: true } },
    },
  })
}

async function anyYellowballoonProduct() {
  const brand = await prisma.brand.findFirst({ where: { brandKey: 'yellowballoon' } })
  if (!brand) return null
  return prisma.product.findFirst({
    where: { brandId: brand.id },
    include: { brand: { select: { brandKey: true } } },
  })
}

function resolveShoppingLikePage(
  moduleKey: ReturnType<typeof resolvePublicConsumptionModuleKey>,
  structured: NonNullable<ReturnType<typeof parseProductRawMetaPublic>>['structuredSignals'],
  shoppingShopOptions: string | null | undefined
) {
  const shoppingStopsFromDb = parseShoppingStopsJson(shoppingShopOptions ?? null)
  const shoppingStopsFromMeta = parseShoppingStopsJson(structured?.shoppingStops ?? null)
  const input = {
    canonical: structured?.shoppingStructured,
    legacyDbRows: shoppingStopsFromDb,
    legacyMetaRows: shoppingStopsFromMeta,
  }
  switch (moduleKey) {
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

function resolveOptionalLikePage(
  moduleKey: ReturnType<typeof resolvePublicConsumptionModuleKey>,
  structured: NonNullable<ReturnType<typeof parseProductRawMetaPublic>>['structuredSignals'],
  optionalToursStructured: string | null | undefined
) {
  const input = {
    canonical: structured?.optionalToursStructuredCanonical,
    legacyOptionalToursStructured: optionalToursStructured ?? null,
  }
  switch (moduleKey) {
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

async function main() {
  const brands = await prisma.brand.findMany({ select: { brandKey: true } })
  console.log('DB brands:', brands.map((b: BrandRow) => b.brandKey).sort().join(', '))

  const targets = ['verygoodtour', 'modetour', 'ybtour'] as const
  const out: Record<string, unknown> = {}

  for (const bk of targets) {
    const p = await oneProduct(bk)
    if (!p) {
      out[bk] = { note: 'no registered product for brand' }
      console.log(`\n=== ${bk} ===\n`, out[bk])
      continue
    }

    const brandKey = p.brand?.brandKey ?? null
    const rawMeta = p.rawMeta ?? null
    const modKey = resolvePublicConsumptionModuleKey(brandKey, p.originSource)
    const mod = pickFlightManualModule(brandKey, p.originSource)
    const fmc = mod.getFlightManualCorrectionFromRawMeta(rawMeta)
    const fmcAgain = pickFlightManualModule(brandKey, p.originSource).getFlightManualCorrectionFromRawMeta(rawMeta)
    assert.equal(stableJson(fmc), stableJson(fmcAgain), 'FMC deterministic')

    const rawParsed = parseProductRawMetaPublic(rawMeta)
    const structured = rawParsed?.structuredSignals

    const shoppingResolved = resolveShoppingLikePage(modKey, structured, p.shoppingShopOptions)
    const optionalResolved = resolveOptionalLikePage(modKey, structured, p.optionalToursStructured)

    let modetourPriceSnapshot: Record<string, unknown> | null = null
    if (bk === 'modetour' && p.departures?.length) {
      const priceTableRawTrim = structured?.priceTableRawText?.trim() ?? ''
      const modetourLabelPriceExtract = priceTableRawTrim
        ? extractProductPriceTableByLabels(priceTableRawTrim)
        : null
      const productPriceTableForMerge =
        mergeProductPriceTableWithLabelExtract(structured?.productPriceTable ?? null, modetourLabelPriceExtract) ??
        structured?.productPriceTable ??
        null
      const merged = mergeProductPriceRowsWithBodyPriceTable(
        productDeparturesToProductPriceRows(p.departures ?? []),
        productPriceTableForMerge,
        { modetourVaryingAdultChildLinkage: true }
      )
      const first = merged[0]
      modetourPriceSnapshot = first
        ? {
            date: first.date,
            adult: first.adult,
            childBed: getPublicPerPaxUnitKrw(first, 'childBed'),
            childNoBed: getPublicPerPaxUnitKrw(first, 'childNoBed'),
            infant: getPublicPerPaxUnitKrw(first, 'infant'),
          }
        : { note: 'merge empty' }
    }

    out[bk] = {
      productId: p.id,
      brandKey,
      originSource: p.originSource,
      resolvePublicConsumptionModuleKey: modKey,
      adminApiFmcSameAsPublicPage: true,
      fmcNonNull: fmc != null,
      fmcOutboundFinalFlightNo: fmc?.outbound?.final?.flightNo ?? null,
      structuredSignalsKeys: structured ? Object.keys(structured).slice(0, 45) : [],
      mustKnowItemsLen: Array.isArray(structured?.mustKnowItems) ? structured!.mustKnowItems!.length : null,
      shoppingStructuredRows: structured?.shoppingStructured?.rows?.length ?? null,
      optionalCanonicalRows: structured?.optionalToursStructuredCanonical?.rows?.length ?? null,
      shoppingResolutionSource: shoppingResolved.source,
      optionalResolutionSource: optionalResolved.source,
      shoppingResolvedRowCount: Array.isArray(shoppingResolved.value) ? shoppingResolved.value.length : null,
      optionalResolvedJsonRows: (() => {
        const v = optionalResolved.value
        if (!v || typeof v !== 'string') return null
        try {
          const j = JSON.parse(v) as unknown
          return Array.isArray(j) ? j.length : null
        } catch {
          return null
        }
      })(),
      modetourFirstRowPublicUnits: modetourPriceSnapshot,
    }

    assert.equal(modKey, bk, `module key must match canonical brand for ${bk}`)
    console.log(`\n=== ${bk} ===\n`, JSON.stringify(out[bk], null, 2))
  }

  const ybLegacy = await anyYellowballoonProduct()
  out._yellowballoonLegacy = ybLegacy
    ? {
        productId: ybLegacy.id,
        brandKey: ybLegacy.brand?.brandKey,
        resolveKey: resolvePublicConsumptionModuleKey(ybLegacy.brand?.brandKey, ybLegacy.originSource),
        fmcUsesYbtourModule:
          pickFlightManualModule(ybLegacy.brand?.brandKey, ybLegacy.originSource) === flightManualYbtour,
      }
    : { note: 'no yellowballoon brand row' }
  console.log(
    '\n=== DB legacy brandKey=yellowballoon (read-only compatibility probe) ===\n',
    JSON.stringify(out._yellowballoonLegacy, null, 2)
  )

  if (ybLegacy && ybLegacy.brand?.brandKey === 'yellowballoon') {
    assert.equal(
      resolvePublicConsumptionModuleKey(ybLegacy.brand.brandKey, ybLegacy.originSource),
      'ybtour',
      'legacy brand maps to ybtour module'
    )
    assert.ok(
      pickFlightManualModule(ybLegacy.brand.brandKey, ybLegacy.originSource) === flightManualYbtour,
      'FMC module for legacy brand is ybtour'
    )
  }

  sectionSyntheticFmcAndKeys()

  await prisma.$disconnect()
  console.log('\nverify-supplier-pipeline-alignment: OK')
}

/** DB 없이도 확인: 동일 rawMeta·structuredSignals.flightManualCorrection 에 대해 공급사별 FMC getter가 동일 페이로드를 반환하는지 */
function sectionSyntheticFmcAndKeys() {
  const rawMetaFmc = JSON.stringify({
    structuredSignals: {
      flightManualCorrection: {
        outbound: { final: { flightNo: 'SYN-FMC-001' } },
        inbound: { final: { flightNo: 'SYN-FMC-002' } },
      },
      shoppingStructured: {
        rows: [{ shoppingItem: '인삼', shoppingPlace: '서울', durationText: '60분' }],
      },
      optionalToursStructuredCanonical: { rows: [{ tourName: '옵션A', adultPrice: 100, currency: 'USD' }] },
      mustKnowItems: [{ category: '현지준비', title: '테스트', body: '본문' }],
    },
  })
  /** `origin`에 한글 문자열이 있는 행은 `resolvePublicConsumptionModuleKey` 정규화 경로 검증용(요청 body 복붙 예시 아님). */
  const rows: Array<{ brandKey: string | null; origin: string | null; expectModuleKey: string }> = [
    { brandKey: 'verygoodtour', origin: null, expectModuleKey: 'verygoodtour' },
    { brandKey: 'modetour', origin: null, expectModuleKey: 'modetour' },
    { brandKey: 'ybtour', origin: null, expectModuleKey: 'ybtour' },
    { brandKey: 'yellowballoon', origin: null, expectModuleKey: 'ybtour' },
    { brandKey: null, origin: '참좋은여행사', expectModuleKey: 'verygoodtour' },
  ]
  const snap: Record<string, unknown> = { syntheticFmc: {} as Record<string, unknown> }
  for (const r of rows) {
    const k = resolvePublicConsumptionModuleKey(r.brandKey, r.origin)
    assert.equal(k, r.expectModuleKey, `resolve key brand=${r.brandKey} origin=${r.origin}`)
    const mod = pickFlightManualModule(r.brandKey, r.origin)
    const fmc = mod.getFlightManualCorrectionFromRawMeta(rawMetaFmc)
    assert.equal(fmc?.outbound?.final?.flightNo, 'SYN-FMC-001')
    assert.equal(fmc?.inbound?.final?.flightNo, 'SYN-FMC-002')
    ;(snap.syntheticFmc as Record<string, unknown>)[`${r.brandKey ?? 'null'}|${r.origin ?? 'null'}`] = {
      moduleKey: k,
      flightNos: { ob: fmc?.outbound?.final?.flightNo, ib: fmc?.inbound?.final?.flightNo },
    }
  }
  const parsed = parseProductRawMetaPublic(rawMetaFmc)
  const st = parsed?.structuredSignals
  assert.ok(st?.mustKnowItems && st.mustKnowItems.length >= 1, 'must-know in rawMeta')
  assert.ok(st?.shoppingStructured?.rows && st.shoppingStructured.rows.length >= 1, 'shopping rows in rawMeta')
  assert.ok(
    st?.optionalToursStructuredCanonical?.rows && st.optionalToursStructuredCanonical.rows.length >= 1,
    'optional canonical rows in rawMeta'
  )
  console.log('\n=== synthetic (no DB) FMC + resolvePublicConsumptionModuleKey + rawMeta 구조 ===\n', JSON.stringify(snap, null, 2))
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
