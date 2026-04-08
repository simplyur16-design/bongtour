import { Suspense } from 'react'
import MonthlyCurationsPageClient from './MonthlyCurationsPageClient'

export default function AdminMonthlyCurationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 text-sm text-gray-500">
          로딩 중…
        </div>
      }
    >
      <MonthlyCurationsPageClient />
    </Suspense>
  )
}
