/**
 * 매월 21일 00:00 KST — MonthlyCurationContent 자동 발행·과거월 비발행.
 * (1) monthKey < base → isPublished=false
 * (2) m+1/+2/+3 중 isPublished=false & 무결성 통과 → isPublished=true
 * (3) 메인 carousel·PC 히어로 unstable_cache 태그 무효화
 *
 * Dry-run: `MONTHLY_CURATION_PUBLISH_CRON_DRY_RUN=1` (DB 쓰기·revalidateTag 생략, 로그만)
 */
import { revalidateTag } from 'next/cache'
import { getSeoulYearMonthNow } from '@/lib/monthly-curation'
import {
  monthlyCurationRowPassesLinkedProductIntegrity,
  resolveValidMonthlyCurationLinkedProductIds,
} from '@/lib/home-season-pick'
import {
  SEASON_CURATION_HERO_CACHE_TAG,
  SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG,
  shiftSeoulYearMonth,
} from '@/lib/season-curation-content'

function isMonthlyPublishDryRun(): boolean {
  return process.env.MONTHLY_CURATION_PUBLISH_CRON_DRY_RUN === '1'
}

export function startInstrumentationMonthlyPublishCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_MONTHLY_PUBLISH_CRON === '1') {
    return
  }
  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        '0 0 21 * *',
        () => {
          void tickMonthlyPublishCron()
        },
        { timezone: 'Asia/Seoul' }
      )
      console.log('[monthly-publish-cron] registered: 0 0 21 * * (Asia/Seoul)')
    })
    .catch((e) => {
      console.error('[monthly-publish-cron] failed to load node-cron', e)
    })
}

async function tickMonthlyPublishCron() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      return
    }
    if (!(process.env.DATABASE_URL ?? '').trim()) {
      console.warn('[monthly-publish-cron] skip: DATABASE_URL')
      return
    }

    const dryRun = isMonthlyPublishDryRun()
    const { prisma } = await import('@/lib/prisma')
    const base = getSeoulYearMonthNow()
    const monthKeys = [1, 2, 3].map((d) => shiftSeoulYearMonth(base, d))

    const unpublishWhere = {
      pageScope: 'overseas' as const,
      isPublished: true,
      monthKey: { lt: base },
    }

    const unpublishCount = dryRun
      ? await prisma.monthlyCurationContent.count({ where: unpublishWhere })
      : (
          await prisma.monthlyCurationContent.updateMany({
            where: unpublishWhere,
            data: { isPublished: false },
          })
        ).count

    const passIds: string[] = []
    for (const monthKey of monthKeys) {
      const rows = await prisma.monthlyCurationContent.findMany({
        where: { pageScope: 'overseas', isPublished: false, monthKey },
        select: { id: true, linkedProductId: true },
      })
      const validLinked = await resolveValidMonthlyCurationLinkedProductIds(
        rows.map((r) => r.linkedProductId ?? '')
      )
      for (const row of rows) {
        if (monthlyCurationRowPassesLinkedProductIntegrity(row, validLinked)) {
          passIds.push(row.id)
        }
      }
    }

    const publishCount = dryRun
      ? passIds.length
      : passIds.length === 0
        ? 0
        : (
            await prisma.monthlyCurationContent.updateMany({
              where: { id: { in: passIds } },
              data: { isPublished: true },
            })
          ).count

    if (!dryRun) {
      revalidateTag(SEASON_CURATION_NEXT_THREE_MONTHS_CACHE_TAG)
      revalidateTag(SEASON_CURATION_HERO_CACHE_TAG)
    }

    console.log('[monthly-publish-cron] tick', {
      dryRun,
      base,
      monthKeys,
      unpublishCount,
      publishCandidateCount: passIds.length,
      publishCount,
    })
  } catch (e) {
    console.error('[monthly-publish-cron] error', e)
  }
}
