import dynamic from 'next/dynamic'
import AdminDashboardHomeClient from './components/AdminDashboardHomeClient'
import AdminPageHeader from './components/AdminPageHeader'

const AdminDashboardControl = dynamic(() => import('./components/AdminDashboardControl'), {
  loading: () => <div className="text-sm text-bt-text-muted-lavender">대시보드 로딩 중...</div>,
})

type Props = {
  searchParams: Promise<{ auth?: string }>
}

/**
 * 관리자 대시보드: 셸 즉시 렌더 + KPI는 클라이언트 API.
 * REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: SSR은 DB KPI await 금지 — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: 등록대기 KPI는 API(countLiveRegisterPrePhotoPendingQueue) — manifest
 * REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: dashboard CTA for affiliation cards — AdminDashboardHomeClient — manifest
 * REGRESSION-FREEZE[admin-mobile-ops-b-register]: dashboard phone-first quick actions — AdminDashboardHomeClient — manifest
 */
export default async function AdminDashboardPage({ searchParams }: Props) {
  const { auth } = await searchParams
  const query = auth ? `?auth=${auth}` : ''

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader title="Bong투어 관리자" subtitle="오늘 현황과 빠른 작업" />

      <AdminDashboardHomeClient query={query} />

      <div className="mt-4 border-t border-bt-border-soft pt-6 md:mt-0 md:border-0 md:pt-0">
        <p className="mb-3 text-xs font-medium text-bt-text-muted-lavender md:hidden">수집·봇 현황 (상세)</p>
        <AdminDashboardControl />
      </div>
    </div>
  )
}
