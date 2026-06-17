import { prisma } from '@/lib/prisma'
import InsightsClient from './InsightsClient'

export const dynamic = 'force-dynamic'

export default async function InsightsPage() {
  let insights: Awaited<ReturnType<typeof prisma.bongPostInsight.findMany>> = []
  let config: Awaited<ReturnType<typeof prisma.bongHookLearnConfig.findUnique>> = null
  let totalCount = 0

  try {
    ;[insights, config, totalCount] = await Promise.all([
      prisma.bongPostInsight.findMany({
        take: 20,
        orderBy: { reach: 'desc' },
        where: { reach: { not: null } },
      }),
      prisma.bongHookLearnConfig.findUnique({ where: { configKey: 'default' } }),
      prisma.bongPostInsight.count(),
    ])
  } catch {
    insights = []
    config = null
    totalCount = 0
  }

  return (
    <InsightsClient initialInsights={insights} initialConfig={config} totalCount={totalCount} />
  )
}
