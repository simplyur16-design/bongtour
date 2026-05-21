import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import MyReviewsListClient from '@/components/mypage/MyReviewsListClient'

export default async function MyPageReviewsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/mypage/reviews')
  }
  return <MyReviewsListClient />
}
