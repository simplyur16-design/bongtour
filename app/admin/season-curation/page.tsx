import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import OverseasContentAdminClient from '@/app/admin/overseas-content/OverseasContentAdminClient'
import SeasonCurationAdminClient from './SeasonCurationAdminClient'

export default async function AdminSeasonCurationPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/season-curation')

  return (
    <div className="space-y-10">
      <SeasonCurationAdminClient />
      <OverseasContentAdminClient view="editorial" />
    </div>
  )
}
