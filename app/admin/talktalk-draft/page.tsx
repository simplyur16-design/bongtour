import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import { TALKTALK_FAQ_NEEDS_ANSWER, talktalkFaqAdminGroups } from '@/lib/talktalk-draft/faq'
import TalktalkDraftClient from './TalktalkDraftClient'

export default async function TalktalkDraftPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/talktalk-draft')
  return <TalktalkDraftClient groups={talktalkFaqAdminGroups()} needsAnswer={[...TALKTALK_FAQ_NEEDS_ANSWER]} />
}
