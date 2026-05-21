import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import MyWishlistClient from '@/components/mypage/MyWishlistClient'

export default async function MyPageWishlistPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin?callbackUrl=/mypage/wishlist')
  }
  return <MyWishlistClient />
}
