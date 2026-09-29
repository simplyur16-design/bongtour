/**
 * 관리자 홈 KPI — 등록대기 숫자는 live verify.ok 큐 SSOT.
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 대시보드 KPI = countLiveRegisterPrePhotoPendingQueue — manifest
 * REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: SSR 셸과 KPI 분리, 짧은 TTL 캐시 — manifest
 */
import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withPrismaRetry } from '@/lib/prisma-retry'
import { countLiveRegisterPrePhotoPendingQueue } from '@/lib/register-pre-photo-pending-queue-query'

export type AdminDashboardKpi = {
  pendingCount: number
  registeredCount: number
  bookingCount: number
  inquiryCount: number
  affiliationPendingCount: number
  consultIntakeTotal: number
}

async function loadAdminDashboardKpiUncached(): Promise<AdminDashboardKpi> {
  // REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 등록대기 KPI = verify.ok 큐 — manifest
  const [pendingCount, registeredCount, bookingCount, inquiryCount, affiliationPendingCount] =
    await Promise.all([
      countLiveRegisterPrePhotoPendingQueue(),
      withPrismaRetry('admin-dashboard-kpi-registered', () =>
        prisma.product.count({ where: { registrationStatus: 'registered' } }),
      ),
      withPrismaRetry('admin-dashboard-kpi-booking', () =>
        prisma.booking.count({ where: { status: { not: '취소' } } }),
      ),
      withPrismaRetry('admin-dashboard-kpi-inquiry', () =>
        prisma.customerInquiry.count({ where: { status: { notIn: ['dropped', 'cancelled'] } } }),
      ),
      withPrismaRetry('admin-dashboard-kpi-affiliation', () =>
        prisma.bongsimAffiliationCardRequest.count({ where: { status: 'pending' } }),
      ).catch(() => 0),
    ])

  return {
    pendingCount,
    registeredCount,
    bookingCount,
    inquiryCount,
    affiliationPendingCount,
    consultIntakeTotal: bookingCount + inquiryCount,
  }
}

/** 45s TTL — 관리자 KPI는 초단위 정확도보다 셸 응답 우선 */
export async function getCachedAdminDashboardKpi(): Promise<AdminDashboardKpi> {
  // REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: short TTL cache — manifest
  return unstable_cache(loadAdminDashboardKpiUncached, ['admin-dashboard-kpi-v1'], {
    revalidate: 45,
  })()
}
