import { Suspense } from 'react'
import { auth } from '@/auth'
import MembersAdminClient from './MembersAdminClient'

export default async function AdminMembersPage() {
  const session = await auth()
  const role = (session?.user as { role?: string | null } | undefined)?.role

  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-500">회원 목록 불러오는 중…</p>}>
      <MembersAdminClient actorRole={role} />
    </Suspense>
  )
}
