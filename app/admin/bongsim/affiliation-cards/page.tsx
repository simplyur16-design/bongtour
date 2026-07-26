import { redirect } from 'next/navigation'
import { requireAffiliationReviewer } from '@/lib/require-admin'
import AffiliationCardsAdminClient from './AffiliationCardsAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminAffiliationCardsPage() {
  const admin = await requireAffiliationReviewer()
  if (!admin) redirect('/admin/members')

  return (
    <div className="mx-auto max-w-5xl space-y-3 px-0 pb-[max(1rem,env(safe-area-inset-bottom))] sm:space-y-4 sm:px-0 md:p-0">
      <div className="px-1 md:px-0">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">소속 명함 승인</h1>
        <p className="mt-1 text-sm text-slate-600">
          명함 확인 후 승인하면 eSIM 직군형 할인이 적용됩니다. 스태프도 승인·반려할 수 있습니다.
        </p>
      </div>
      <AffiliationCardsAdminClient />
    </div>
  )
}
