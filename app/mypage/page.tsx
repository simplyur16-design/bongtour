'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import Header from '@/app/components/Header'

/** 로그인 사용자용 보조 허브. 찜·문의 이력 등은 추후 확장. */
export default function MyPage() {
  const { data: session, status } = useSession()

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-xl font-bold text-bt-ink">마이페이지</h1>
        {status === 'loading' ? (
          <p className="mt-4 text-sm text-bt-muted">불러오는 중…</p>
        ) : session?.user ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-bt-muted">
              <span className="font-medium text-bt-ink">로그인 계정</span>
              <br />
              {session.user.name ?? session.user.email ?? '—'}
            </p>
            <p className="text-sm leading-relaxed text-bt-muted">
              찜·문의 이력·개인화 기능은 단계적으로 제공될 예정입니다. 지금은 상품 탐색을 로그인 없이 이용하실 수 있습니다.
            </p>
            <Link
              href="/mypage/reviews/write"
              className="inline-block rounded-lg border border-bt-border bg-white px-4 py-2 text-sm font-medium text-bt-ink hover:bg-bt-surface"
            >
              여행 후기 작성
            </Link>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="rounded-md border border-bt-border px-4 py-2 text-sm font-medium text-bt-ink/80 transition hover:bg-bt-page"
            >
              로그아웃
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-bt-muted">로그인 후 이용할 수 있습니다.</p>
            <Link
              href="/auth/signin?callbackUrl=/mypage"
              className="inline-block rounded-md bg-bt-cta-primary px-4 py-2 text-sm font-semibold text-bt-cta-primary-fg transition hover:bg-bt-cta-primary-hover"
            >
              로그인
            </Link>
          </div>
        )}
        <Link href="/" className="mt-8 inline-block text-sm text-bt-muted hover:text-bt-ink">
          ← 홈으로
        </Link>
      </main>
    </div>
  )
}
