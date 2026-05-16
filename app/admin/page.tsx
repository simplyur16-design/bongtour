import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ADMIN_BTN_PRIMARY_CLASS,
  ADMIN_BTN_SECONDARY_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from '@/lib/admin-design-system'
import { prisma } from '@/lib/prisma'
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

  const [pendingCount, registeredCount, bookingCount] = await Promise.all([
    prisma.product.count({ where: { registrationStatus: 'pending' } }),
    prisma.product.count({ where: { registrationStatus: 'registered' } }),
    prisma.booking.count({ where: { status: { not: '취소' } } }),
  ])

  return (
    <div className="mx-auto max-w-6xl">
        <AdminPageHeader title="Bong투어 관리자" subtitle="오늘 현황과 빠른 작업" />

        {/* KPI 카드 */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminKpiCard label="등록대기" value={`${pendingCount}건`} href={`/admin/pending${query}`} />
          <AdminKpiCard label="상품 목록" value={`${registeredCount}건`} href={`/admin/products${query}`} />
          <AdminKpiCard label="상담 접수" value={`${bookingCount}건`} href={`/admin/bookings${query}`} />
          <AdminKpiCard label="오늘 수집" value={<span className="text-base font-normal text-bt-text-muted-lavender">아래 차트 참고</span>} tone="muted" />
        </section>

        {/* 빠른 액션 */}
        <section className="mb-8">
          <h2 className={ADMIN_SECTION_TITLE_CLASS}>빠른 액션</h2>
          <div className="flex flex-wrap gap-3">
            <Link href={`/admin/register${query}`} className={ADMIN_BTN_PRIMARY_CLASS}>
              상품 등록
            </Link>
            <Link href={`/admin/pending${query}`} className={ADMIN_BTN_SECONDARY_CLASS}>
              등록대기 보기
            </Link>
            <Link href={`/admin/products${query}`} className={ADMIN_BTN_SECONDARY_CLASS}>
              상품 목록 보기
            </Link>
            <Link href={`/admin/bookings${query}`} className={ADMIN_BTN_SECONDARY_CLASS}>
              상담·예약 보기
            </Link>
            <Link href={`/admin/brands${query}`} className={ADMIN_BTN_SECONDARY_CLASS}>
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

        {/* 오늘 수집 현황 · 봇 상태 · 가격 동기화 1회 · 로그 */}
        <AdminDashboardControl />
    </div>
  )
}
