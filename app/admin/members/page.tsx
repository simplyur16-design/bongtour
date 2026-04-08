import { auth } from '@/auth'
import MembersAdminClient from './MembersAdminClient'

export default async function AdminMembersPage() {
  const session = await auth()
  const role = (session?.user as { role?: string | null } | undefined)?.role

  return <MembersAdminClient actorRole={role} />
}
