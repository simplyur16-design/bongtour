import type { ReactNode } from 'react'
import Link from 'next/link'
import { BadgeCheck, Heart, MessageSquareText, PenLine, Smartphone } from 'lucide-react'
import Header from '@/app/components/Header'

// REGRESSION-FREEZE[mypage-hub-affiliation-esim-first]: affiliation + esim hub first; coupons/marketing menus omitted — manifest
// REGRESSION-FREEZE[site-chrome-hide-own-bottom-dock]: no left sidebar; own bottom dock only; site chrome hidden — manifest
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
      <div className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pt-8">
        <div className="min-w-0">{children}</div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#DAD4EE] bg-white/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2"
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
