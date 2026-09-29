/**
 * 관리자 홈 KPI JSON — HTML 셸과 분리해 DB 대기 시에도 /admin 이 74초 붙잡히지 않게.
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: countLiveRegisterPrePhotoPendingQueue — manifest
 * REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: shell-first KPI API — manifest
 */
import { getCachedAdminDashboardKpi } from '@/lib/admin/dashboard-kpi'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return jsonWithLeakGuard({ error: 'unauthorized' }, 'admin.dashboard-kpi', { status: 401 })
  }

  try {
    const kpi = await getCachedAdminDashboardKpi()
    return jsonWithLeakGuard({ ok: true, ...kpi }, 'admin.dashboard-kpi.response')
  } catch (e) {
    console.error('[admin/dashboard-kpi]', e)
    return jsonWithLeakGuard({ error: 'query_failed' }, 'admin.dashboard-kpi', { status: 500 })
  }
}
