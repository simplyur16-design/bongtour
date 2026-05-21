import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import MyInquiriesClient from '@/components/mypage/MyInquiriesClient'

export default async function MyPageInquiriesPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/mypage/inquiries')
  }
  return <MyInquiriesClient />
}
