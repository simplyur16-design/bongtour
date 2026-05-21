'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import ReviewWriteForm from '@/app/mypage/reviews/write/ReviewWriteForm'
import MypagePageHeading from '@/components/mypage/MypagePageHeading'

function ReviewWritePageInner() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const editId = searchParams?.get('edit') ?? null

  return (
    <main className="mx-auto max-w-lg py-2 sm:max-w-xl">
      <MypagePageHeading
        title={editId ? '여행 후기 수정' : '여행 후기 작성'}
        description="우리끼리 · 패키지 · 자유여행 중 선택 후 작성해 주세요."
      />
      {status === 'loading' ? (
        <p className="text-sm text-[#534AB7]">불러오는 중…</p>
      ) : !session?.user ? (
        <div className="space-y-4">
          <p className="text-[15px] text-[#534AB7]">로그인 후 후기를 제출할 수 있습니다.</p>
          <Link
            href={`/auth/signin?callbackUrl=${encodeURIComponent(editId ? `/mypage/reviews/write?edit=${editId}` : '/mypage/reviews/write')}`}
            className="inline-block rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
          >
            로그인
          </Link>
        </div>
      ) : (
        <ReviewWriteForm editId={editId} />
      )}
    </main>
  )
}

export default function MyPageReviewWritePage() {
  return (
    <Suspense fallback={<p className="py-8 text-sm text-[#534AB7]">불러오는 중…</p>}>
      <ReviewWritePageInner />
    </Suspense>
  )
}
