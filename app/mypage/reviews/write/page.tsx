'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import ReviewWriteForm from '@/app/mypage/reviews/write/ReviewWriteForm'

export default function MyPageReviewWritePage() {
  const { data: session, status } = useSession()

  return (
    <main className="mx-auto max-w-lg py-4 sm:max-w-xl">
      <Link href="/mypage" className="text-sm text-slate-500 hover:text-teal-800">
        ← 마이페이지
      </Link>
      <h1 className="mt-4 text-xl font-bold text-slate-900">여행 후기 작성</h1>
      {status === 'loading' ? (
        <p className="mt-6 text-sm text-slate-500">불러오는 중…</p>
      ) : !session?.user ? (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-slate-600">로그인 후 후기를 제출할 수 있습니다.</p>
          <Link
            href="/auth/signin?callbackUrl=/mypage/reviews/write"
            className="inline-block rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:from-teal-600 hover:to-cyan-700"
          >
            로그인
          </Link>
        </div>
      ) : (
        <ReviewWriteForm />
      )}
    </main>
  )
}
