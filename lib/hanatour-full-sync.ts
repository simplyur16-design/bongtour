/**
 * 관리용 하나투어 전체 동기화: (레거시 Python CLI 제거됨) Prisma 연동.
 */
import type { PrismaClient } from '@prisma/client'
import { upsertHanatourMonthlyBenefit } from '@/lib/hanatour-monthly-benefit'
import type {
  HanatourCardInstallmentBenefit,
  HanatourHanaExtraCard,
  HanatourMonthlyBenefitRecord,
} from '@/lib/hanatour-types'
import { prismaProductUpdateFromHanatourPayload, type HanatourProductPayload } from '@/lib/hanatour-product-sync'
import { upsertItineraryDays, type ItineraryDayInput } from '@/lib/upsert-itinerary-days-hanatour'
import { upsertProductDepartures, type DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import { SCRAPE_DEFAULT_MONTHS_FORWARD } from '@/lib/scrape-date-bounds'

type SyncFullPythonResult = {
  product?: HanatourProductPayload
  itineraryDays?: Array<Record<string, unknown>>
  departures?: DepartureInput[]
  departureMeta?: { collectorStatus?: string; notes?: string[]; log?: Record<string, unknown> }
}

export async function runHanatourSyncFullCli(
  detailUrl: string,
  maxMonths = SCRAPE_DEFAULT_MONTHS_FORWARD
): Promise<SyncFullPythonResult> {
  void detailUrl
  void maxMonths
  throw new Error(
    'Hanatour sync-full: legacy Python CLI removed; no replacement module in repo.'
  )
}

export async function runHanatourSyncProductCli(detailUrl: string): Promise<HanatourProductPayload> {
  void detailUrl
  throw new Error(
    'Hanatour sync-product: legacy Python CLI removed; no replacement module in repo.'
  )
}

function mapItineraryDay(row: Record<string, unknown>): ItineraryDayInput | null {
  const day = Number(row.day)
  if (!Number.isInteger(day) || day < 1) return null
  const rawBlock = row.rawBlock != null ? String(row.rawBlock).trim() : ''
  if (!rawBlock) return null
  return {
    day,
    dateText: row.dateText != null ? String(row.dateText) : null,
    city: row.city != null ? String(row.city) : null,
    summaryTextRaw: row.summaryTextRaw != null ? String(row.summaryTextRaw) : null,
    poiNamesRaw: row.poiNamesRaw != null ? String(row.poiNamesRaw) : null,
    meals: row.meals != null ? String(row.meals) : null,
    accommodation: row.accommodation != null ? String(row.accommodation) : null,
    transport: row.transport != null ? String(row.transport) : null,
    rawBlock,
  }
}

/**
 * productId에 대해 상세 URL 기준 전체 동기화.
 */
export async function applyHanatourFullSyncToProduct(
  prisma: PrismaClient,
  productId: string,
  detailUrl: string,
  options?: { maxMonths?: number; skipDepartures?: boolean }
): Promise<SyncFullPythonResult> {
  const maxMonths = options?.maxMonths ?? SCRAPE_DEFAULT_MONTHS_FORWARD
  const data = await runHanatourSyncFullCli(detailUrl, maxMonths)

  if (data.product && Object.keys(data.product).length > 0) {
    const raw = { ...data.product } as Record<string, unknown>
    delete raw._itineraryError
    const update = prismaProductUpdateFromHanatourPayload(raw as HanatourProductPayload)
    await prisma.product.update({
      where: { id: productId },
      data: update,
    })
  }

  const days = (data.itineraryDays ?? [])
    .map(mapItineraryDay)
    .filter((x): x is ItineraryDayInput => x != null)
  if (days.length > 0) {
    await upsertItineraryDays(prisma, productId, days)
  }

  if (!options?.skipDepartures && data.departures && data.departures.length > 0) {
    await upsertProductDepartures(prisma, productId, data.departures as DepartureInput[])
  }

  return data
}

type MonthlyBenefitPython = {
  record: {
    supplierKey: string
    benefitMonth: string
    sourceUrl?: string | null
    isActive: boolean
    cardInstallmentBenefits: unknown[]
    hanaExtraCards: unknown[]
    commonNoticesRaw?: string | null
    benefitSummaryRaw?: string | null
    fetchedAt?: string | null
    rawMeta?: string | null
  }
}

export async function runHanatourMonthlyBenefitCli(
  benefitMonth?: string,
  benefitUrl?: string
): Promise<MonthlyBenefitPython['record']> {
  void benefitMonth
  void benefitUrl
  throw new Error(
    'Hanatour monthly-benefit: legacy Python CLI removed; no replacement module in repo.'
  )
}

export async function applyHanatourMonthlyBenefitRescrape(
  prisma: PrismaClient,
  productIdsToLinkBenefitMonth?: string[],
  options?: { benefitMonth?: string; benefitUrl?: string }
): Promise<void> {
  const rec = await runHanatourMonthlyBenefitCli(options?.benefitMonth, options?.benefitUrl)
  const record: HanatourMonthlyBenefitRecord = {
    supplierKey: rec.supplierKey || 'hanatour',
    benefitMonth: rec.benefitMonth,
    sourceUrl: rec.sourceUrl ?? null,
    isActive: rec.isActive,
    cardInstallmentBenefits: (rec.cardInstallmentBenefits ?? []) as HanatourCardInstallmentBenefit[],
    hanaExtraCards: (rec.hanaExtraCards ?? []) as HanatourHanaExtraCard[],
    commonNoticesRaw: rec.commonNoticesRaw ?? null,
    benefitSummaryRaw: rec.benefitSummaryRaw ?? null,
    fetchedAt: rec.fetchedAt ? new Date(rec.fetchedAt) : new Date(),
    rawMeta: rec.rawMeta ? (JSON.parse(rec.rawMeta) as Record<string, unknown>) : null,
  }
  await upsertHanatourMonthlyBenefit(prisma, record)

  const ym = rec.benefitMonth
  if (ym && productIdsToLinkBenefitMonth?.length) {
    await prisma.product.updateMany({
      where: { id: { in: productIdsToLinkBenefitMonth } },
      data: {
        benefitMonthRef: ym,
        hasMonthlyCardBenefit: (rec.cardInstallmentBenefits?.length ?? 0) > 0,
      },
    })
  }
}
