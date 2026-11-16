import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import TalktalkDraftClient from './TalktalkDraftClient'

export default async function TalktalkDraftPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/talktalk-draft')
  return <TalktalkDraftClient />
}
