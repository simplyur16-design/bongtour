import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ADMIN_BTN_PRIMARY_CLASS,
  ADMIN_BTN_SECONDARY_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from '@/lib/admin-design-system'
import { prisma } from '@/lib/prisma'
import { countLiveRegisterPrePhotoPendingQueue } from '@/lib/register-pre-photo-pending-queue-query'
import AdminEmptyState from './components/AdminEmptyState'
import AdminKpiCard from './components/AdminKpiCard'
import AdminPageHeader from './components/AdminPageHeader'

const AdminDashboardControl = dynamic(() => import('./components/AdminDashboardControl'), {
  loading: () => <div className="text-sm text-bt-text-muted-lavender">대시보드 로딩 중...</div>,
})

type Props = {
  searchParams: Promise<{ auth?: string }>
}

/**
 * 관리자 대시보드: 오늘 현황(KPI) + 빠른 액션 + 오늘 수집·봇 상태·로그.
 * IA 개편: 기존 홈(저장·시세·상담·등록상품)은 상품 등록/등록대기/상품 목록/상담·예약으로 분리됨.
 */
export default async function AdminDashboardPage({ searchParams }: Props) {
  const { auth } = await searchParams
  const query = auth ? `?auth=${auth}` : ''

  const [pendingCount, registeredCount, bookingCount, inquiryCount, affiliationPendingCount] =
    await Promise.all([
      // REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 등록대기 KPI = verify.ok 큐 — manifest
      countLiveRegisterPrePhotoPendingQueue(),
      prisma.product.count({ where: { registrationStatus: 'registered' } }),
      prisma.booking.count({ where: { status: { not: '취소' } } }),
      prisma.customerInquiry.count({ where: { status: { notIn: ['dropped', 'cancelled'] } } }),
      prisma.bongsimAffiliationCardRequest.count({ where: { status: 'pending' } }).catch(() => 0),
    ])
  const consultIntakeTotal = bookingCount + inquiryCount

  return (
    <div className="mx-auto max-w-6xl">
        <AdminPageHeader title="Bong투어 관리자" subtitle="오늘 현황과 빠른 작업" />

        {/* KPI 카드 */}
        {/* REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: dashboard CTA for affiliation cards — manifest */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <AdminKpiCard
            label="소속 명함 승인대기"
            value={`${affiliationPendingCount}건`}
            href={`/admin/bongsim/affiliation-cards${query}`}
          />
          <AdminKpiCard label="등록대기" value={`${pendingCount}건`} href={`/admin/pending${query}`} />
          <AdminKpiCard label="상품 목록" value={`${registeredCount}건`} href={`/admin/products${query}`} />
          <AdminKpiCard
            label="상담·접수"
            value={`${consultIntakeTotal}건`}
            href={`/admin/bookings${query}`}
          />
          <AdminKpiCard label="오늘 수집" value={<span className="text-base font-normal text-bt-text-muted-lavender">아래 차트 참고</span>} tone="muted" />
        </section>

        {/* 빠른 액션 — 모바일 우선 운영 링크 */}
        {/* REGRESSION-FREEZE[admin-mobile-ops-b-register]: dashboard phone-first quick actions — manifest */}
        <section className="mb-8" data-admin-mobile-dashboard-actions="true">
          <h2 className={ADMIN_SECTION_TITLE_CLASS}>빠른 액션</h2>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
            <Link
              href={`/admin/bongsim/affiliation-cards${query}`}
              className={`${ADMIN_BTN_PRIMARY_CLASS} min-h-12 w-full sm:w-auto`}
            >
              소속 명함 승인
              {affiliationPendingCount > 0 ? ` (${affiliationPendingCount})` : ''}
            </Link>
            <Link href={`/admin/register${query}`} className={`${ADMIN_BTN_PRIMARY_CLASS} min-h-12 w-full sm:w-auto`}>
              상품 등록
            </Link>
            <Link href={`/admin/bookings${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
              상담·예약
            </Link>
            <Link href={`/admin/inquiries${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
              문의 접수
            </Link>
            <Link href={`/admin/pending${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
              등록대기
            </Link>
            <Link href={`/admin/products${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
              상품 목록
            </Link>
            <Link
              href={`/admin/training-programs/new${query}`}
              className={`${ADMIN_BTN_SECONDARY_CLASS} hidden min-h-12 w-full sm:inline-flex sm:w-auto`}
            >
              국외연수 프로그램 등록
            </Link>
            <Link
              href={`/admin/brands${query}`}
              className={`${ADMIN_BTN_SECONDARY_CLASS} hidden min-h-12 w-full sm:inline-flex sm:w-auto`}
            >
              브랜드 관리
            </Link>
          </div>
        </section>

        {/* 빈 상태 안내 */}
        {pendingCount === 0 && registeredCount === 0 && (
          <div className="mb-8">
            <AdminEmptyState
              title="등록대기 0건, 상품 0건"
              description="상품 등록에서 첫 상품을 추가해 보세요."
              actionLabel="상품 등록"
              actionHref={`/admin/register${query}`}
            />
          </div>
        )}

        {/* 오늘 수집 현황 · 봇 상태 · 가격 동기화 1회 · 로그 — 모바일에서는 하단 */}
        <div className="mt-4 border-t border-bt-border-soft pt-6 md:mt-0 md:border-0 md:pt-0">
          <p className="mb-3 text-xs font-medium text-bt-text-muted-lavender md:hidden">수집·봇 현황 (상세)</p>
          <AdminDashboardControl />
        </div>
    </div>
  )
}
