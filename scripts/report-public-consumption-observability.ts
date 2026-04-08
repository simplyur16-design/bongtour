import { prisma } from '@/lib/prisma'
import { normalizeSupplierOrigin, OVERSEAS_SUPPLIER_LABEL, type OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { parseProductRawMetaPublic, parseShoppingStopsJson } from '@/lib/public-product-extras'
import * as publicConsumptionHanatour from '@/lib/public-consumption-hanatour'
import * as publicConsumptionModetour from '@/lib/public-consumption-modetour'
import * as publicConsumptionVerygoodtour from '@/lib/public-consumption-verygoodtour'
import * as publicConsumptionYbtour from '@/lib/public-consumption-ybtour'
import { parseOptionalToursForUi } from '@/lib/optional-tours-ui-model'
import { resolveDayHotelPlansForPublic } from '@/lib/day-hotel-plans-hanatour'

type SectionKey = 'hotel' | 'optional' | 'shopping'
type Mode = 'canonical-first' | 'legacy-fallback' | 'none'

function asMode(source: string, usedFallback: boolean): Mode {
  if (source === 'none') return 'none'
  return usedFallback ? 'legacy-fallback' : 'canonical-first'
}

type ScheduleHotelRow = { day: number; hotelText: string | null }

function parseScheduleForHotel(schedule: string | null | undefined): Array<{ day: number; hotelText?: string | null }> | null {
  if (!schedule?.trim()) return null
  try {
    const arr = JSON.parse(schedule) as unknown
    if (!Array.isArray(arr)) return null
    const rows: ScheduleHotelRow[] = arr
      .map((row) => {
        const r = row as Record<string, unknown>
        const day = Number(r.day)
        if (!Number.isFinite(day) || day < 1) return null
        const hotelText =
          typeof r.hotelText === 'string'
            ? r.hotelText
            : typeof r.accommodation === 'string'
              ? r.accommodation
              : null
        return { day, hotelText }
      })
      .filter((x): x is ScheduleHotelRow => x != null)
    return rows.length > 0 ? rows : null
  } catch {
    return null
  }
}

async function run() {
  const SAMPLE_SIZE = 50
  const products = await prisma.product.findMany({
    take: SAMPLE_SIZE,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      originSource: true,
      optionalToursStructured: true,
      shoppingShopOptions: true,
      schedule: true,
      hotelSummaryRaw: true,
      rawMeta: true,
    },
  })

  const sectionTotals: Record<SectionKey, { total: number; canonical: number; fallback: number; none: number }> = {
    hotel: { total: 0, canonical: 0, fallback: 0, none: 0 },
    optional: { total: 0, canonical: 0, fallback: 0, none: 0 },
    shopping: { total: 0, canonical: 0, fallback: 0, none: 0 },
  }

  const supplierFallback: Record<OverseasSupplierKey, Record<SectionKey, number>> = {
    hanatour: { hotel: 0, optional: 0, shopping: 0 },
    modetour: { hotel: 0, optional: 0, shopping: 0 },
    verygoodtour: { hotel: 0, optional: 0, shopping: 0 },
    ybtour: { hotel: 0, optional: 0, shopping: 0 },
    etc: { hotel: 0, optional: 0, shopping: 0 },
  }

  const rowDiffStats: Record<SectionKey, { anyDiff: number; gt1Diff: number }> = {
    hotel: { anyDiff: 0, gt1Diff: 0 },
    optional: { anyDiff: 0, gt1Diff: 0 },
    shopping: { anyDiff: 0, gt1Diff: 0 },
  }

  for (const p of products) {
    const rawParsed = parseProductRawMetaPublic(p.rawMeta ?? null)
    const s = rawParsed?.structuredSignals
    const supplier = normalizeSupplierOrigin(p.originSource)

    const optionalDecision =
      supplier === 'modetour'
        ? publicConsumptionModetour.resolveOptionalToursConsumption({
            canonical: s?.optionalToursStructuredCanonical,
            legacyOptionalToursStructured: p.optionalToursStructured ?? null,
          })
        : supplier === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveOptionalToursConsumption({
              canonical: s?.optionalToursStructuredCanonical,
              legacyOptionalToursStructured: p.optionalToursStructured ?? null,
            })
          : supplier === 'ybtour'
            ? publicConsumptionYbtour.resolveOptionalToursConsumption({
                canonical: s?.optionalToursStructuredCanonical,
                legacyOptionalToursStructured: p.optionalToursStructured ?? null,
              })
            : publicConsumptionHanatour.resolveOptionalToursConsumption({
                canonical: s?.optionalToursStructuredCanonical,
                legacyOptionalToursStructured: p.optionalToursStructured ?? null,
              })
    const shoppingDecision =
      supplier === 'modetour'
        ? publicConsumptionModetour.resolveShoppingConsumption({
            canonical: s?.shoppingStructured,
            legacyDbRows: parseShoppingStopsJson(p.shoppingShopOptions ?? null),
            legacyMetaRows: parseShoppingStopsJson(s?.shoppingStops ?? null),
          })
        : supplier === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveShoppingConsumption({
              canonical: s?.shoppingStructured,
              legacyDbRows: parseShoppingStopsJson(p.shoppingShopOptions ?? null),
              legacyMetaRows: parseShoppingStopsJson(s?.shoppingStops ?? null),
            })
          : supplier === 'ybtour'
            ? publicConsumptionYbtour.resolveShoppingConsumption({
                canonical: s?.shoppingStructured,
                legacyDbRows: parseShoppingStopsJson(p.shoppingShopOptions ?? null),
                legacyMetaRows: parseShoppingStopsJson(s?.shoppingStops ?? null),
              })
            : publicConsumptionHanatour.resolveShoppingConsumption({
                canonical: s?.shoppingStructured,
                legacyDbRows: parseShoppingStopsJson(p.shoppingShopOptions ?? null),
                legacyMetaRows: parseShoppingStopsJson(s?.shoppingStops ?? null),
              })
    const hotelDecision =
      supplier === 'modetour'
        ? publicConsumptionModetour.resolveHotelConsumption({
            canonical: s?.hotelStructured,
            legacyStructuredPlans: s?.dayHotelPlans ?? null,
            hasLegacyNarrativeFallback: Boolean((s?.hotelInfoRaw ?? '').trim() || (p.hotelSummaryRaw ?? '').trim()),
          })
        : supplier === 'verygoodtour'
          ? publicConsumptionVerygoodtour.resolveHotelConsumption({
              canonical: s?.hotelStructured,
              legacyStructuredPlans: s?.dayHotelPlans ?? null,
              hasLegacyNarrativeFallback: Boolean((s?.hotelInfoRaw ?? '').trim() || (p.hotelSummaryRaw ?? '').trim()),
            })
          : supplier === 'ybtour'
            ? publicConsumptionYbtour.resolveHotelConsumption({
                canonical: s?.hotelStructured,
                legacyStructuredPlans: s?.dayHotelPlans ?? null,
                hasLegacyNarrativeFallback: Boolean((s?.hotelInfoRaw ?? '').trim() || (p.hotelSummaryRaw ?? '').trim()),
              })
            : publicConsumptionHanatour.resolveHotelConsumption({
                canonical: s?.hotelStructured,
                legacyStructuredPlans: s?.dayHotelPlans ?? null,
                hasLegacyNarrativeFallback: Boolean((s?.hotelInfoRaw ?? '').trim() || (p.hotelSummaryRaw ?? '').trim()),
              })

    const modes: Record<SectionKey, Mode> = {
      optional: asMode(optionalDecision.source, optionalDecision.usedFallback),
      shopping: asMode(shoppingDecision.source, shoppingDecision.usedFallback),
      hotel: asMode(hotelDecision.source, hotelDecision.usedFallback),
    }

    ;(['hotel', 'optional', 'shopping'] as SectionKey[]).forEach((k) => {
      sectionTotals[k].total += 1
      if (modes[k] === 'canonical-first') sectionTotals[k].canonical += 1
      else if (modes[k] === 'legacy-fallback') {
        sectionTotals[k].fallback += 1
        supplierFallback[supplier][k] += 1
      } else {
        sectionTotals[k].none += 1
      }
    })

    const previewOptionalRows = Array.isArray(s?.optionalToursStructuredCanonical?.rows)
      ? s!.optionalToursStructuredCanonical!.rows!.length
      : 0
    const previewShoppingRows = Array.isArray(s?.shoppingStructured?.rows) ? s!.shoppingStructured!.rows!.length : 0
    const previewHotelRows = Array.isArray(s?.hotelStructured?.rows) ? s!.hotelStructured!.rows!.length : 0

    const publicOptionalRows = parseOptionalToursForUi(optionalDecision.value).length
    const publicShoppingRows = shoppingDecision.value.length
    const publicHotelRows = resolveDayHotelPlansForPublic(
      hotelDecision.value,
      s?.hotelInfoRaw ?? null,
      p.hotelSummaryRaw ?? null,
      parseScheduleForHotel(p.schedule)
    ).length

    const diffs: Record<SectionKey, number> = {
      optional: Math.abs(previewOptionalRows - publicOptionalRows),
      shopping: Math.abs(previewShoppingRows - publicShoppingRows),
      hotel: Math.abs(previewHotelRows - publicHotelRows),
    }
    ;(['hotel', 'optional', 'shopping'] as SectionKey[]).forEach((k) => {
      if (diffs[k] > 0) rowDiffStats[k].anyDiff += 1
      if (diffs[k] > 1) rowDiffStats[k].gt1Diff += 1
    })
  }

  const pct = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '0.0%')

  console.log(`\nPublic consumption observability report (recent ${products.length} products)\n`)
  console.log('| Section | canonical-first | legacy-fallback | none |')
  console.log('|---|---:|---:|---:|')
  ;(['hotel', 'optional', 'shopping'] as SectionKey[]).forEach((k) => {
    const t = sectionTotals[k]
    console.log(
      `| ${k} | ${t.canonical}/${t.total} (${pct(t.canonical, t.total)}) | ${t.fallback}/${t.total} (${pct(t.fallback, t.total)}) | ${t.none}/${t.total} (${pct(t.none, t.total)}) |`
    )
  })

  console.log('\n| Supplier | Hotel fallback hits | Optional fallback hits | Shopping fallback hits |')
  console.log('|---|---:|---:|---:|')
  ;(Object.keys(supplierFallback) as OverseasSupplierKey[]).forEach((k) => {
    const row = supplierFallback[k]
    console.log(`| ${OVERSEAS_SUPPLIER_LABEL[k]} | ${row.hotel} | ${row.optional} | ${row.shopping} |`)
  })

  console.log('\n| Section | preview/public any row diff freq | preview/public abs diff > 1 freq |')
  console.log('|---|---:|---:|')
  ;(['hotel', 'optional', 'shopping'] as SectionKey[]).forEach((k) => {
    console.log(
      `| ${k} | ${rowDiffStats[k].anyDiff}/${products.length} (${pct(rowDiffStats[k].anyDiff, products.length)}) | ${rowDiffStats[k].gt1Diff}/${products.length} (${pct(rowDiffStats[k].gt1Diff, products.length)}) |`
    )
  })
}

run()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
