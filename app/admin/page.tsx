import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import AdminDashboardControl from './components/AdminDashboardControl'
import AdminEmptyState from './components/AdminEmptyState'
import AdminKpiCard from './components/AdminKpiCard'
import AdminPageHeader from './components/AdminPageHeader'

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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <AdminPageHeader title="Bong투어 관리자" subtitle="오늘 현황과 빠른 작업" />

        {/* KPI 카드 */}
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminKpiCard label="등록대기" value={`${pendingCount}건`} href={`/admin/pending${query}`} />
          <AdminKpiCard label="상품 목록" value={`${registeredCount}건`} href={`/admin/products${query}`} />
          <AdminKpiCard label="상담 접수" value={`${bookingCount}건`} href={`/admin/bookings${query}`} />
          <AdminKpiCard label="오늘 수집" value={<span className="text-base font-normal text-gray-600">아래 차트 참고</span>} tone="muted" />
        </section>

        {/* 빠른 액션 */}
        <section className="mb-8">
          <h2 className="mb-4 border-l-4 border-[#0f172a] pl-4 text-lg font-bold text-[#0f172a]">
            빠른 액션
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/admin/register${query}`}
              className="rounded-lg bg-[#0f172a] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1e293b]"
            >
              상품 등록
            </Link>
            <Link
              href={`/admin/pending${query}`}
              className="rounded-lg border border-[#0f172a] px-4 py-2.5 text-sm font-medium text-[#0f172a] transition hover:bg-[#0f172a] hover:text-white"
            >
              등록대기 보기
            </Link>
            <Link
              href={`/admin/products${query}`}
              className="rounded-lg border border-[#0f172a] px-4 py-2.5 text-sm font-medium text-[#0f172a] transition hover:bg-[#0f172a] hover:text-white"
            >
              상품 목록 보기
            </Link>
            <Link
              href={`/admin/bookings${query}`}
              className="rounded-lg border border-[#0f172a] px-4 py-2.5 text-sm font-medium text-[#0f172a] transition hover:bg-[#0f172a] hover:text-white"
            >
              상담·예약 보기
            </Link>
            <Link
              href={`/admin/brands${query}`}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
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

        {/* 오늘 수집 현황 · 봇 상태 · 가격 동기화 1회 · 로그 */}
        <AdminDashboardControl />
      </div>
    </div>
  )
}
