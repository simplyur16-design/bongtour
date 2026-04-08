/**
 * HanatourMonthlyBenefit 월 단위 upsert (상품별 중복 저장 금지).
 */
import type { PrismaClient } from '@prisma/client'
import type { HanatourMonthlyBenefitRecord } from '@/lib/hanatour-types'

function jsonStringifySafe(v: unknown): string | null {
  if (v == null) return null
  try {
    return JSON.stringify(v)
  } catch {
    return null
  }
}

export async function upsertHanatourMonthlyBenefit(
  prisma: PrismaClient,
  record: HanatourMonthlyBenefitRecord
): Promise<void> {
  const supplierKey = record.supplierKey || 'hanatour'
  const benefitMonth = record.benefitMonth.trim()
  if (!/^\d{4}-\d{2}$/.test(benefitMonth)) return

  const cardInstallmentBenefits = jsonStringifySafe(record.cardInstallmentBenefits)
  const hanaExtraCards = jsonStringifySafe(record.hanaExtraCards)
  const rawMeta = jsonStringifySafe(record.rawMeta ?? null)

  await prisma.hanatourMonthlyBenefit.upsert({
    where: {
      supplierKey_benefitMonth: { supplierKey, benefitMonth },
    },
    create: {
      supplierKey,
      benefitMonth,
      sourceUrl: record.sourceUrl ?? null,
      isActive: record.isActive,
      cardInstallmentBenefits,
      hanaExtraCards,
      commonNoticesRaw: record.commonNoticesRaw ?? null,
      benefitSummaryRaw: record.benefitSummaryRaw ?? null,
      fetchedAt: record.fetchedAt ?? new Date(),
      rawMeta,
    },
    update: {
      sourceUrl: record.sourceUrl ?? null,
      isActive: record.isActive,
      cardInstallmentBenefits,
      hanaExtraCards,
      commonNoticesRaw: record.commonNoticesRaw ?? null,
      benefitSummaryRaw: record.benefitSummaryRaw ?? null,
      fetchedAt: record.fetchedAt ?? new Date(),
      rawMeta,
    },
  })
}
