/**
 * MonthlyCurationContent 자동 생성 — `generateMonthlyCuration`(Gemini) 래퍼.
 * 대상 월: 서울 기준 현재월 +1, +2 (매달 1일 cron·서버 기동 시드).
 */
import { prisma } from '@/lib/prisma'
import { generateMonthlyCuration } from '@/lib/gemini-curation'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'

const PAGE_SCOPE_OVERSEAS = 'overseas' as const

export function addMonthsToMonthKey(monthKey: string, deltaMonths: number): string {
  const [ys, ms] = monthKey.split('-')
  const y = parseInt(ys, 10)
  const m = parseInt(ms, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    throw new Error(`Invalid monthKey: ${monthKey}`)
  }
  const d = new Date(Date.UTC(y, m - 1 + deltaMonths, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 서울 기준 현재월로부터 +1·+2달 monthKey */
export function monthlyCurationAutoTargetMonthKeys(nowMonthKey = getSeoulYearMonthNow()): string[] {
  return [addMonthsToMonthKey(nowMonthKey, 1), addMonthsToMonthKey(nowMonthKey, 2)]
}

export type MonthlyCurationAutoMonthResult =
  | { monthKey: string; status: 'skipped'; reason: 'exists' | 'no_gemini_key'; existing: number }
  | { monthKey: string; status: 'created'; created: number; items: { id: string; title: string }[] }
  | { monthKey: string; status: 'failed'; error: string; code?: string }

export async function ensureMonthlyCurationsForMonthKeys(
  monthKeys: string[],
  options?: { overwrite?: boolean },
): Promise<MonthlyCurationAutoMonthResult[]> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()
  if (!apiKey) {
    return monthKeys.map((monthKey) => ({
      monthKey,
      status: 'skipped' as const,
      reason: 'no_gemini_key' as const,
      existing: 0,
    }))
  }

  const results: MonthlyCurationAutoMonthResult[] = []
  for (const monthKey of monthKeys) {
    const existing = await prisma.monthlyCurationContent.count({
      where: { monthKey, pageScope: PAGE_SCOPE_OVERSEAS },
    })
    if (existing > 0 && !options?.overwrite) {
      results.push({ monthKey, status: 'skipped', reason: 'exists', existing })
      continue
    }
    const r = await generateMonthlyCuration(monthKey, {
      overwrite: options?.overwrite === true && existing > 0,
    })
    if (!r.ok) {
      results.push({
        monthKey,
        status: 'failed',
        error: r.error,
        code: r.code,
      })
      continue
    }
    results.push({
      monthKey,
      status: 'created',
      created: r.created,
      items: r.items.map((x) => ({ id: x.id, title: x.title })),
    })
  }
  return results
}

/** cron·시드 기본: +1·+2달 부족분만 생성 */
export async function ensureMonthlyCurationAutoSeed(
  options?: { overwrite?: boolean; nowMonthKey?: string },
): Promise<MonthlyCurationAutoMonthResult[]> {
  const monthKeys = monthlyCurationAutoTargetMonthKeys(options?.nowMonthKey)
  return ensureMonthlyCurationsForMonthKeys(monthKeys, options)
}
