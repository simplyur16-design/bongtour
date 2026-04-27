import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import CountryHeroesAdminClient from './CountryHeroesAdminClient'

export default async function AdminBongsimCountryHeroesPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/bongsim/country-heroes')

  return (
    <div className="mx-auto max-w-5xl pb-16 text-slate-100">
      <CountryHeroesAdminClient />
    </div>
  )
}
