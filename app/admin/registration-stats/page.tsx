import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import RegistrationStatsClient from './RegistrationStatsClient'

export default async function AdminRegistrationStatsPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/registration-stats')
  return <RegistrationStatsClient />
}
