import { Suspense } from 'react'
import OverseasContentAdminClient from '@/app/admin/overseas-content/OverseasContentAdminClient'
import MonthlyCurationGenerateClient from './MonthlyCurationGenerateClient'

export default function AdminMonthlyCurationGeneratePage() {
  return (
    <div className="space-y-10">
      <Suspense fallback={<p className="p-6 text-sm text-bt-muted">불러오는 중…</p>}>
        <MonthlyCurationGenerateClient />
      </Suspense>
      <OverseasContentAdminClient view="monthly" />
    </div>
  )
}
