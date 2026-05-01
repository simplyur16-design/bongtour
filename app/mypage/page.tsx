'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

/** 로그인 사용자용 보조 허브. 찜·문의 이력 등은 추후 확장. */
export default function MyPage() {
  const { data: session, status } = useSession()

  return (
    <main className="mx-auto max-w-md py-4">
        <h1 className="text-xl font-bold text-slate-900">마이페이지</h1>
        {status === 'loading' ? (
          <p className="mt-4 text-sm text-slate-500">불러오는 중…</p>
        ) : session?.user ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">로그인 계정</span>
              <br />
              {session.user.name ?? session.user.email ?? '—'}
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              찜·문의 이력·개인화 기능은 단계적으로 제공될 예정입니다. 지금은 상품 탐색을 로그인 없이 이용하실 수 있습니다.
            </p>
            <Link
              href="/mypage/esim"
              className="inline-block rounded-xl border border-teal-200 bg-teal-50/90 px-4 py-2 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-100"
            >
              내 eSIM 주문내역
            </Link>
            <Link
              href="/mypage/reviews/write"
              className="inline-block rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              여행 후기 작성
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-600">로그인 후 이용할 수 있습니다.</p>
            <Link
              href="/auth/signin?callbackUrl=/mypage"
              className="inline-block rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-teal-600 hover:to-cyan-700"
            >
              로그인
            </Link>
          </div>
        )}
        <Link href="/" className="mt-8 inline-block text-sm text-slate-500 hover:text-teal-800">
          ← 홈으로
        </Link>
      </main>
  )
}
