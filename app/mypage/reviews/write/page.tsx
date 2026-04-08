'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import Header from '@/app/components/Header'
import ReviewWriteForm from '@/app/mypage/reviews/write/ReviewWriteForm'

export default function MyPageReviewWritePage() {
  const { data: session, status } = useSession()

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-10 sm:max-w-xl">
        <Link href="/mypage" className="text-sm text-bt-muted hover:text-bt-ink">
          ← 마이페이지
        </Link>
        <h1 className="mt-4 text-xl font-bold text-bt-ink">여행 후기 작성</h1>
        {status === 'loading' ? (
          <p className="mt-6 text-sm text-bt-muted">불러오는 중…</p>
        ) : !session?.user ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-bt-muted">로그인 후 후기를 제출할 수 있습니다.</p>
            <Link
              href="/auth/signin?callbackUrl=/mypage/reviews/write"
              className="inline-block rounded-xl bg-bt-cta-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-bt-cta-primary-hover"
            >
              로그인
            </Link>
          </div>
        ) : (
          <ReviewWriteForm />
        )}
      </main>
    </div>
  )
}
