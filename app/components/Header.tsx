'use client'

import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X } from 'lucide-react'

/** 전역 헤더 — 여행사형 메가메뉴는 `/travel/overseas` 서브메인(`OverseasTravelSubMainNav`)에만 둔다. */
const MAIN_NAV: { label: string; href: string }[] = [
  { label: '해외여행', href: '/travel/overseas' },
  { label: '국내여행', href: '/travel/domestic' },
  { label: '국외연수', href: '/training' },
  { label: '전세버스', href: '/charter-bus' },
  { label: '항공권 예매 및 발권', href: '/air-ticketing' },
  { label: '고객지원', href: '/support' },
]

function HeaderAuthRow({ className = '' }: { className?: string }) {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className={`h-10 w-36 animate-pulse rounded bg-bt-border/60 ${className}`} aria-hidden />
  }

  if (session?.user) {
    const label = session.user.name?.trim() || session.user.email?.split('@')[0] || '계정'
    return (
      <div className={`flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:gap-x-3 ${className}`}>
        <span
          className="hidden max-w-[8rem] truncate text-sm text-bt-muted sm:inline sm:max-w-[9rem] sm:text-[14px]"
          title={session.user.email ?? ''}
        >
          {label}
        </span>
        <Link
          href="/mypage"
          className="rounded-md px-3 py-2.5 text-[14px] font-medium text-bt-muted transition hover:bg-bt-page hover:text-bt-link sm:text-[15px]"
        >
          마이페이지
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-md px-3 py-2.5 text-[14px] font-medium text-bt-muted transition hover:bg-bt-page hover:text-bt-link sm:text-[15px]"
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div className={`flex flex-wrap items-center justify-end gap-x-2 gap-y-1.5 sm:gap-x-3 ${className}`}>
      <Link
        href="/auth/signin"
        className="rounded-md px-3 py-2.5 text-[14px] font-medium text-bt-muted transition hover:bg-bt-page hover:text-bt-link sm:text-[15px]"
      >
        로그인
      </Link>
      <Link
        href="/auth/signup"
        className="rounded-md px-3 py-2.5 text-[14px] font-medium text-bt-muted transition hover:bg-bt-page hover:text-bt-link sm:text-[15px]"
      >
        회원가입
      </Link>
    </div>
  )
}

export default function Header() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-bt-border-soft bg-white shadow-sm">
      <div className="border-b border-bt-border-soft/70 bg-white/95">
        <div className="mx-auto flex max-w-6xl items-center justify-end px-4 py-1.5 sm:px-6">
          <HeaderAuthRow className="w-full overflow-x-auto whitespace-nowrap sm:w-auto" />
        </div>
      </div>
      <div className={`flex min-h-[4.5rem] items-center gap-3 py-2 sm:min-h-[5rem] ${SITE_CONTENT_CLASS}`}>
        <Link
          href="/"
          className="relative isolate z-10 inline-flex shrink-0 items-center overflow-hidden py-0.5"
          aria-label="Bong투어 홈"
        >
          <Image
            src="/images/bongtour-logo.png"
            alt=""
            width={274}
            height={78}
            className="relative z-0 block h-11 w-auto object-contain object-left sm:h-12 lg:h-[3.1rem]"
            priority
          />
        </Link>

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-3 lg:flex xl:gap-5"
          aria-label="주요 메뉴"
        >
          {MAIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3.5 py-2.5 text-[16px] font-semibold leading-tight tracking-[-0.01em] text-slate-900 transition hover:bg-bt-surface-alt hover:text-bt-title xl:px-4 xl:text-[17px]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
          <button
            type="button"
            className="shrink-0 rounded-md border border-bt-border-soft p-2.5 text-bt-title sm:p-3"
            aria-expanded={open}
            aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="h-5 w-5 sm:h-6 sm:w-6" /> : <Menu className="h-5 w-5 sm:h-6 sm:w-6" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-bt-border-soft bg-white lg:hidden">
          <ul className={`py-2.5 ${SITE_CONTENT_CLASS}`}>
            {MAIN_NAV.map((item) => (
              <li key={item.label} className="border-b border-slate-100 last:border-0">
                <Link
                  href={item.href}
                  className="block py-4 text-center text-[17px] font-semibold leading-snug text-bt-title"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  )
}
