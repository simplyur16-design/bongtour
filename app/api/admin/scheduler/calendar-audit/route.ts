import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { determineScrapeStrategy } from '@/lib/scraper-schedule-strategy'

export const dynamic = 'force-dynamic'

/** GET — 날짜별 요금 자동 수집(캘린더 배치) 운영 상태 점검 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const now = new Date()
  const strategy = await determineScrapeStrategy()

  const registeredCount = await prisma.product.count({
    where: { registrationStatus: 'registered', originCode: { not: '' } },
  })

  const withFutureDepartures = await prisma.product.count({
    where: {
      registrationStatus: 'registered',
      departures: { some: { departureDate: { gte: now } } },
    },
  })

  const depUpdated7d = await prisma.productDeparture.count({
    where: { syncedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
  })

  const bearerConfigured = Boolean(
    (process.env.ADMIN_SERVICE_BEARER_SECRET ?? '').trim() ||
      (process.env.ADMIN_BYPASS_SECRET ?? '').trim(),
  )
  const apiBase =
    (process.env.BONGTOUR_API_BASE ?? '').trim() ||
    (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() ||
    (process.env.NEXTAUTH_URL ?? '').trim() ||
    ''

  const cronDisabled = process.env.DISABLE_INSTRUMENTATION_CALENDAR_CRON === '1'
  const isProduction = process.env.NODE_ENV === 'production'

  const issues: string[] = []
  if (!isProduction) {
    issues.push('로컬(dev)에서는 instrumentation 캘린더 크론이 등록되지 않습니다. 운영 서버 또는 「스케줄러」에서 수동 실행하세요.')
  }
  if (!bearerConfigured) {
    issues.push('ADMIN_SERVICE_BEARER_SECRET(또는 ADMIN_BYPASS_SECRET)이 없으면 Python 배치가 API를 호출하지 못합니다.')
  }
  if (!apiBase && isProduction) {
    issues.push('BONGTOUR_API_BASE / NEXT_PUBLIC_SITE_URL 이 비어 있으면 Python이 localhost로 저장을 시도할 수 있습니다.')
  }
  if (cronDisabled) {
    issues.push('DISABLE_INSTRUMENTATION_CALENDAR_CRON=1 로 자동 배치가 꺼져 있습니다.')
  }
  if (!strategy.shouldRunToday) {
    issues.push(
      `오늘은 배치 실행일이 아닙니다(유지보수 모드·월요일만). 모드: ${strategy.mode}, 구간: ${strategy.dateRangeStartYmd}~${strategy.dateRangeEndYmd}`,
    )
  }

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV ?? 'unknown',
      cronRegistered: isProduction && bearerConfigured && !cronDisabled,
      bearerConfigured,
      apiBaseConfigured: Boolean(apiBase),
      apiBasePreview: apiBase ? apiBase.replace(/\/$/, '') : null,
    },
    strategy,
    counts: {
      registeredProducts: registeredCount,
      registeredWithFutureDepartures: withFutureDepartures,
      departuresUpdatedLast7Days: depUpdated7d,
    },
    scheduleNote:
      '운영: 매일 21:00 KST instrumentation → Python calendar_price_scheduler (상품당 로테이션·1회 최대 30건). dev는 자동 없음.',
    issues,
  })
}
