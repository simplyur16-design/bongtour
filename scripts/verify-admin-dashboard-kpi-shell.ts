/**
 * REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: /admin SSR는 KPI DB await 금지 — manifest
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors: string[] = []

function read(rel: string) {
  return readFileSync(path.join(root, rel), 'utf8')
}

const page = read('app/admin/page.tsx')
if (!page.includes('REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]')) {
  errors.push('page.tsx missing freeze marker')
}
if (!page.includes('AdminDashboardHomeClient')) {
  errors.push('page.tsx must render AdminDashboardHomeClient')
}
if (page.includes('countLiveRegisterPrePhotoPendingQueue()')) {
  errors.push('page.tsx must not call countLiveRegisterPrePhotoPendingQueue()')
}
if (page.includes('prisma.product.count')) {
  errors.push('page.tsx must not prisma.product.count (KPI deferred to API)')
}
if (page.includes("registrationStatus: 'pending'")) {
  errors.push('page.tsx must not use pending status count')
}

const api = read('app/api/admin/dashboard-kpi/route.ts')
if (!api.includes('REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]')) {
  errors.push('dashboard-kpi route missing freeze marker')
}
if (!api.includes('getCachedAdminDashboardKpi')) {
  errors.push('dashboard-kpi route must use getCachedAdminDashboardKpi')
}

const lib = read('lib/admin/dashboard-kpi.ts')
if (!lib.includes('countLiveRegisterPrePhotoPendingQueue')) {
  errors.push('dashboard-kpi lib must call countLiveRegisterPrePhotoPendingQueue')
}
if (!lib.includes('revalidate: 45')) {
  errors.push('dashboard-kpi lib must use short TTL revalidate: 45')
}
if (lib.includes("prisma.product.count({ where: { registrationStatus: 'pending' } })")) {
  errors.push('dashboard-kpi must not use simple pending count')
}

const client = read('app/admin/components/AdminDashboardKpiSection.tsx')
if (!client.includes('/api/admin/dashboard-kpi')) {
  errors.push('AdminDashboardKpiSection must fetch /api/admin/dashboard-kpi')
}
if (!client.includes('KPI_TIMEOUT_MS')) {
  errors.push('AdminDashboardKpiSection must timeout KPI fetch')
}

if (errors.length) {
  console.error('FAIL admin-dashboard-kpi-shell-first:\n' + errors.map((e) => `- ${e}`).join('\n'))
  process.exit(1)
}
console.log('PASS admin-dashboard-kpi-shell-first')
