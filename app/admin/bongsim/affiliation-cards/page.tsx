import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import AffiliationCardsAdminClient from './AffiliationCardsAdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminAffiliationCardsPage() {
  const admin = await requireAdmin()
  if (!admin) redirect('/admin')

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">소속 명함 승인</h1>
        <p className="mt-1 text-sm text-slate-600">
          회원이 제출한 명함을 확인하고 승인하면 eSIM 직군형 할인이 지속 적용됩니다.
        </p>
      </div>
      <AffiliationCardsAdminClient />
    </div>
  )
}
