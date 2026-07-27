import type { ReactNode } from 'react'
import Link from 'next/link'
import { BadgeCheck, Heart, MessageSquareText, PenLine, Smartphone } from 'lucide-react'
import Header from '@/app/components/Header'

// REGRESSION-FREEZE[mypage-hub-affiliation-esim-first]: affiliation + esim hub first; coupons/marketing menus omitted — manifest
const nav = [
  { href: '/mypage/affiliation', label: '소속 명함 인증', icon: BadgeCheck },
  { href: '/mypage/esim', label: '내 eSIM', icon: Smartphone },
  { href: '/mypage/wishlist', label: '찜', icon: Heart },
  { href: '/mypage/inquiries', label: '문의 이력', icon: MessageSquareText },
  { href: '/mypage/reviews', label: '여행 후기', icon: PenLine },
] as const

export default function MyPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#EFEDF8]/60 via-white to-[#F5F2EA]">
      <Header />
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 pb-28 pt-6 md:flex-row md:pb-12 md:pt-8">
        <aside className="hidden shrink-0 md:block md:w-56">
          <nav
            className="sticky top-24 space-y-1 rounded-2xl border border-[#DAD4EE] bg-white p-3 shadow-sm"
            aria-label="마이페이지 메뉴"
          >
            <Link
              href="/mypage"
              className="mb-1 block rounded-xl px-3 py-2 text-sm font-bold text-[#1F1B2D] hover:bg-[#EFEDF8]"
            >
              마이페이지 홈
            </Link>
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[15px] font-medium text-[#534AB7] transition hover:bg-[#EFEDF8] hover:text-[#1F1B2D]"
              >
                <Icon className="h-5 w-5 shrink-0 text-[#534AB7]" aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#DAD4EE] bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_16px_rgba(83,74,183,0.08)] backdrop-blur-md md:hidden"
        aria-label="마이페이지 하단 메뉴"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-0.5 px-1">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold text-[#534AB7] transition active:bg-[#EFEDF8]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EFEDF8] text-[#534AB7]">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}
