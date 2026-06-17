import { prisma } from '@/lib/prisma'
import { debugLog } from '@/lib/bong-marketing/debug-log'

export interface HookLearnResult {
  learnedGood: number
  learnedBad: number
  skippedDuplicates: number
  totalSampleSize: number
}

/**
 * 캡션 첫 유효 줄을 헤드라인으로 추출 (5–60자, 해시태그 전용 줄 제외).
 */
export function extractHeadlineFromCaption(caption: string): string | null {
  const lines = caption
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  for (const line of lines) {
    if (line.length < 5 || line.length > 60) continue
    if (line.startsWith('#')) continue
    if (!/[\p{L}\p{N}]/u.test(line)) continue
    return line
  }

  return null
}

export function computePercentileSliceCount(total: number, percentile: number): number {
  return Math.max(1, Math.floor((total * percentile) / 100))
}

export async function learnHooksFromInsights(): Promise<HookLearnResult> {
  const config = await prisma.bongHookLearnConfig.findUnique({
    where: { configKey: 'default' },
  })

  if (!config || !config.enabled) {
    debugLog('hook-learn', '학습 비활성화 또는 설정 없음')
    return { learnedGood: 0, learnedBad: 0, skippedDuplicates: 0, totalSampleSize: 0 }
  }

  const insights = await prisma.bongPostInsight.findMany({
    where: {
      reach: { not: null },
      publishedAt: {
        gte: new Date(Date.now() - config.lookbackDays * 24 * 60 * 60 * 1000),
      },
      caption: { not: null },
      sourceType: 'instagram-organic',
    },
    orderBy: { reach: 'desc' },
  })

  if (insights.length < config.minSampleSize) {
    debugLog('hook-learn', `샘플 부족: ${insights.length} < ${config.minSampleSize}`)
    return {
      learnedGood: 0,
      learnedBad: 0,
      skippedDuplicates: 0,
      totalSampleSize: insights.length,
    }
  }

  const topCount = computePercentileSliceCount(insights.length, config.topPercentile)
  const bottomCount = computePercentileSliceCount(insights.length, config.bottomPercentile)

  const topInsights = insights.slice(0, topCount)
  const bottomInsights = insights.slice(-bottomCount)

  let learnedGood = 0
  let learnedBad = 0
  let skippedDuplicates = 0

  for (const insight of topInsights) {
    const headline = extractHeadlineFromCaption(insight.caption!)
    if (!headline) continue

    const existing = await prisma.bongHookLibrary.findFirst({
      where: { hookText: headline },
    })
    if (existing) {
      skippedDuplicates++
      continue
    }

    await prisma.bongHookLibrary.create({
      data: {
        hookText: headline,
        hookType: 'good',
        source: 'insight-learned',
        context: JSON.stringify({
          instaMediaId: insight.instaMediaId,
          reach: insight.reach,
          likes: insight.likes,
          saved: insight.saved,
          permalink: insight.permalink,
          learnedAt: new Date().toISOString(),
        }),
        tags: [],
        isActive: true,
      },
    })
    learnedGood++
  }

  for (const insight of bottomInsights) {
    const headline = extractHeadlineFromCaption(insight.caption!)
    if (!headline) continue

    const existing = await prisma.bongHookLibrary.findFirst({
      where: { hookText: headline },
    })
    if (existing) {
      skippedDuplicates++
      continue
    }

    await prisma.bongHookLibrary.create({
      data: {
        hookText: headline,
        hookType: 'bad',
        source: 'insight-learned',
        context: JSON.stringify({
          instaMediaId: insight.instaMediaId,
          reach: insight.reach,
          permalink: insight.permalink,
          learnedAt: new Date().toISOString(),
        }),
        tags: [],
        isActive: true,
      },
    })
    learnedBad++
  }

  const result = { learnedGood, learnedBad, skippedDuplicates, totalSampleSize: insights.length }
  debugLog('hook-learn', '완료:', result)
  return result
}
