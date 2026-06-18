import { Suspense } from 'react'
import CurationEventsAdminClient from '@/app/admin/marketing/components/CurationEventsAdminClient'

export const dynamic = 'force-dynamic'

export default function CurationEventsAdminPage() {
  return (
    <div className="mx-auto max-w-6xl p-4">
      <Suspense fallback={<p className="text-sm text-bt-body/70">불러오는 중…</p>}>
        <CurationEventsAdminClient />
      </Suspense>
    </div>
  )
}
