'use client'

import Link from 'next/link'
import { BadgeCheck, Bell, Gift, Heart, MessageSquareText, PenLine, Smartphone } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

const HUB_LINKS = [
  { href: '/mypage/wishlist', label: '찜', desc: '관심 상품·프로그램', icon: Heart },
  { href: '/mypage/inquiries', label: '문의 이력', desc: '상담·견적 접수 내역', icon: MessageSquareText },
  { href: '/mypage/esim', label: '내 eSIM 주문내역', desc: '주문·QR·취소·환불', icon: Smartphone },
  { href: '/mypage/reviews', label: '여행 후기', desc: '목록·작성·수정', icon: PenLine },
  { href: '/mypage/coupons', label: '내 쿠폰함', desc: '할인권 확인', icon: Gift },
  { href: '/mypage/affiliation', label: '소속 명함 인증', desc: '명함 제출·관리자 승인 후 eSIM 할인', icon: BadgeCheck },
  { href: '/mypage/marketing-consent', label: '마케팅 수신 동의', desc: '동의 여부·일자 확인', icon: Bell },
] as const

export default function MyPage() {
  const { data: session, status } = useSession()

  return (
    <main className="mx-auto max-w-2xl py-2">
      <h1 className="text-2xl font-bold text-[#1F1B2D]">마이페이지</h1>

      {status === 'loading' ? (
        <p className="mt-4 text-[15px] text-[#534AB7]">불러오는 중…</p>
      ) : session?.user ? (
        <>
          <p className="mt-3 text-[15px] text-[#534AB7]">
            <span className="font-semibold text-[#1F1B2D]">
              {session.user.name ?? session.user.email ?? '회원'}
            </span>
            님, 안녕하세요.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {HUB_LINKS.map(({ href, label, desc, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex h-full flex-col rounded-2xl border border-[#DAD4EE] bg-white p-4 shadow-sm transition hover:border-[#534AB7]/40 hover:bg-[#EFEDF8]/40"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EFEDF8] text-[#534AB7]">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="mt-3 text-[17px] font-bold text-[#1F1B2D]">{label}</span>
                  <span className="mt-1 text-sm text-[#534AB7]">{desc}</span>
                </Link>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: '/' })}
            className="mt-8 rounded-full border border-[#DAD4EE] px-5 py-2.5 text-sm font-medium text-[#534AB7] hover:bg-[#EFEDF8]"
          >
            로그아웃
          </button>
        </>
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-[15px] text-[#534AB7]">로그인 후 이용할 수 있습니다.</p>
          <Link
            href="/auth/signin?callbackUrl=/mypage"
            className="inline-block rounded-full bg-[#534AB7] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4339A0]"
          >
            로그인
          </Link>
        </div>
      )}

      <Link href="/" className="mt-8 inline-block text-sm font-medium text-[#534AB7] hover:text-[#1F1B2D]">
        ← 홈으로
      </Link>
    </main>
  )
}
