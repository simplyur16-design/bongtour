import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import TalktalkAutoReplyClient from './TalktalkAutoReplyClient'

export default async function TalktalkAutoReplyPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/talktalk-autoreply')
  return <TalktalkAutoReplyClient liveEnabled={process.env.NAVER_TALKTALK_AUTOREPLY === 'live'} />
}
