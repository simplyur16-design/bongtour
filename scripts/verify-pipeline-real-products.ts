/**
 * 실측 상품 ID 기준: 관리자 structuredSignalsPreview vs 공개 parseProductRawMetaPublic, 키·FMC.
 * 로그·요약에서 공급사 식별은 **`modetour` / `verygoodtour` 등 canonical `brandKey`** 기준으로 읽는다.
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 *
 *   npx tsx scripts/verify-pipeline-real-products.ts
 */
import { prisma } from '../lib/prisma'
import { parseProductRawMetaPublic, parseShoppingStopsJson } from '../lib/public-product-extras'
import { resolvePublicConsumptionModuleKey } from '../lib/resolve-public-consumption-module-key'
import * as flightManualModetour from '../lib/flight-manual-correction-modetour'
import * as flightManualVerygoodtour from '../lib/flight-manual-correction-verygoodtour'
import * as publicConsumptionModetour from '../lib/public-consumption-modetour'
import * as publicConsumptionVerygood from '../lib/public-consumption-verygoodtour'
import { computeModetourCalendarSearchToYmd, MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD } from '../lib/scrape-date-bounds'

function pickFmc(brandKey: string | null | undefined, originSource: string | null | undefined) {
  switch (resolvePublicConsumptionModuleKey(brandKey, originSource)) {
    case 'modetour':
      return flightManualModetour.getFlightManualCorrectionFromRawMeta.bind(flightManualModetour)
    case 'verygoodtour':
      return flightManualVerygoodtour.getFlightManualCorrectionFromRawMeta.bind(flightManualVerygoodtour)
    default:
      return null
  }
}

function adminLikeShoppingRows(rawMeta: string | null) {
  const rawParsed = parseProductRawMetaPublic(rawMeta ?? null)
  const sig = rawParsed?.structuredSignals
  const shopSr = sig?.shoppingStructured?.rows
  if (!Array.isArray(shopSr) || shopSr.length === 0) return { count: 0, sample: null as unknown }
  return {
    count: shopSr.length,
    sample: shopSr.slice(0, 2).map((r) => ({
      city: r.city ?? null,
      shopName: r.shopName ?? null,
      shoppingItem: r.shoppingItem ?? '',
    })),
  }
}

function publicResolveShopping(
  modKey: ReturnType<typeof resolvePublicConsumptionModuleKey>,
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
  return modKey === 'modetour'
    ? publicConsumptionModetour.resolveShoppingConsumption(input)
    : publicConsumptionVerygood.resolveShoppingConsumption(input)
}

function publicResolveOptional(
  modKey: ReturnType<typeof resolvePublicConsumptionModuleKey>,
  structured: NonNullable<ReturnType<typeof parseProductRawMetaPublic>>['structuredSignals'],
  optionalToursStructured: string | null | undefined
) {
  const input = {
    canonical: structured?.optionalToursStructuredCanonical,
    legacyOptionalToursStructured: optionalToursStructured ?? null,
  }
  return modKey === 'modetour'
    ? publicConsumptionModetour.resolveOptionalToursConsumption(input)
    : publicConsumptionVerygood.resolveOptionalToursConsumption(input)
}

async function one(id: string) {
  const p = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      originCode: true,
      originSource: true,
      registrationStatus: true,
      rawMeta: true,
      flightAdminJson: true,
      shoppingShopOptions: true,
      optionalToursStructured: true,
      schedule: true,
      counselingNotes: true,
      brand: { select: { brandKey: true } },
      departures: { select: { id: true }, take: 500 },
    },
  })
  if (!p) return { id, error: 'NOT_FOUND' }
  const brandKey = p.brand?.brandKey ?? null
  const modKey = resolvePublicConsumptionModuleKey(brandKey, p.originSource)
  const fmcFn = pickFmc(brandKey, p.originSource)
  const fmc = fmcFn ? fmcFn(p.rawMeta ?? null) : null
  const rawParsed = parseProductRawMetaPublic(p.rawMeta ?? null)
  const structured = rawParsed?.structuredSignals
  const shopAdmin = adminLikeShoppingRows(p.rawMeta ?? null)
  const shopPub = publicResolveShopping(modKey, structured, p.shoppingShopOptions)
  const optPub = publicResolveOptional(modKey, structured, p.optionalToursStructured)
  const optionalCanonicalRowsLen = Array.isArray(structured?.optionalToursStructuredCanonical?.rows)
    ? structured.optionalToursStructuredCanonical.rows.length
    : 0
  const shopPubLen = Array.isArray(shopPub.value) ? shopPub.value.length : 0
  const mustKnow = structured?.mustKnowItems ?? null
  let structuredSignalsKeys: string[] = []
  try {
    const rm = p.rawMeta ? (JSON.parse(p.rawMeta) as { structuredSignals?: unknown }) : null
    const ss = rm?.structuredSignals
    if (ss && typeof ss === 'object' && !Array.isArray(ss)) structuredSignalsKeys = Object.keys(ss as object)
  } catch {
    structuredSignalsKeys = []
  }
  return {
    id: p.id,
    originCode: p.originCode,
    registrationStatus: p.registrationStatus,
    canonicalModuleKey: modKey,
    brandKey,
    departureRowCount: p.departures.length,
    modetourSearchToYmdIfApplied: modKey === 'modetour' ? computeModetourCalendarSearchToYmd(MODETOUR_REGISTER_CONFIRM_MONTHS_FORWARD) : null,
    fmcKeys: fmc && typeof fmc === 'object' ? Object.keys(fmc as object).slice(0, 12) : fmc,
    shoppingStructuredRowCount: shopAdmin.count,
    shoppingPublicResolvedLen: shopPubLen,
    shoppingPublicSource: shopPub.source,
    shoppingParityCanonical:
      shopAdmin.count === shopPubLen &&
      (shopPubLen === 0 || shopPub.source === 'canonical_shopping'),
    optionalPublicSource: optPub.source,
    optionalPublicValueKind: typeof optPub.value,
    mustKnowItemsLen: Array.isArray(mustKnow) ? mustKnow.length : 0,
    meetingInfoRaw: structured?.meetingInfoRaw ?? null,
    meetingFallbackText: structured?.meetingFallbackText ?? null,
    scheduleLen: (p.schedule ?? '').length,
    counselingNotesLen: (p.counselingNotes ?? '').length,
    structuredSignalsKeysSample: structuredSignalsKeys.slice(0, 30),
    optionalToursStructuredDbLen: (p.optionalToursStructured ?? '').length,
    optionalCanonicalRowsLen,
  }
}

async function main() {
  const ids = ['cmnlyonrj00064doikaskbeic', 'cmnlyq1th000i4doiyo9hanoh']
  for (const id of ids) {
    console.log(JSON.stringify(await one(id), null, 2))
  }
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
