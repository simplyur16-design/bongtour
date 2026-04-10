'use client'

import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { useEffect, useId, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { Menu, X } from 'lucide-react'

/** GNB(16px semibold)보다 한 단 낮은 상단 유틸 전용 — 높이·굵기를 맞춰 ‘메뉴’처럼 보이지 않게 */
const HEADER_UTIL_LINK_CLASS =
  'inline-flex shrink-0 items-center rounded-md px-2 py-1 text-[13px] font-normal leading-none text-bt-muted transition hover:bg-bt-page hover:text-bt-link sm:px-2.5 sm:py-1.5 sm:text-[14px]'

function UtilDivider() {
  return (
    <span className="select-none text-[11px] font-light text-bt-border-soft" aria-hidden="true">
      |
    </span>
  )
}

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
    return <div className={`h-7 w-32 animate-pulse rounded bg-bt-border/60 sm:h-8 ${className}`} aria-hidden />
  }

  if (session?.user) {
    const label = session.user.name?.trim() || session.user.email?.split('@')[0] || '계정'
    return (
      <div className={`flex flex-wrap items-center justify-end gap-x-1.5 gap-y-1 sm:gap-x-2 ${className}`}>
        <div className="hidden items-center gap-x-1.5 sm:flex sm:gap-x-2">
          <span
            className="max-w-[9rem] truncate text-[14px] font-normal text-bt-muted"
            title={session.user.email ?? ''}
          >
            {label}
          </span>
          <UtilDivider />
        </div>
        <Link href="/mypage" className={HEADER_UTIL_LINK_CLASS}>
          마이페이지
        </Link>
        <UtilDivider />
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/' })}
          className={HEADER_UTIL_LINK_CLASS}
        >
          로그아웃
        </button>
      </div>
    )
  }

  return (
    <div
      className={`flex flex-nowrap items-center justify-end gap-x-1.5 sm:gap-x-2 ${className}`}
      aria-label="계정 메뉴"
    >
      <Link href="/auth/signin" className={HEADER_UTIL_LINK_CLASS}>
        로그인
      </Link>
      <UtilDivider />
      <Link href="/auth/signup" className={HEADER_UTIL_LINK_CLASS}>
        회원가입
      </Link>
    </div>
  )
}

/** 운영 계정 — env 미설정 시에도 헤더에 표시 (NEXT_PUBLIC_INSTAGRAM_URL로 덮어쓰기 가능) */
const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/bongtour103'

const instagramHref = (() => {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_INSTAGRAM_URL === 'string'
      ? process.env.NEXT_PUBLIC_INSTAGRAM_URL.trim()
      : ''
  return fromEnv || DEFAULT_INSTAGRAM_URL
})()

/** 인스타그램 공식 글리프에 가까운 그라데이션(브랜드 가이드 색상 근사) */
function InstagramGlyphIcon({ gradientId }: { gradientId: string }) {
  return (
    <svg
      className="h-6 w-6 shrink-0"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <radialGradient id={gradientId} cx="13.018%" cy="100%" r="149.888%">
          <stop offset="9%" stopColor="#FFC800" />
          <stop offset="28%" stopColor="#FF5630" />
          <stop offset="48%" stopColor="#BC2A8D" />
          <stop offset="68%" stopColor="#8A3AC8" />
          <stop offset="90%" stopColor="#4C68D7" />
        </radialGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"
      />
    </svg>
  )
}

export default function Header() {
  const [open, setOpen] = useState(false)
  const instagramGradientId = `ig-glyph-${useId().replace(/:/g, '')}`
  const instagramGradientIdMobile = `ig-glyph-m-${useId().replace(/:/g, '')}`

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
        <div className="mx-auto flex min-h-0 max-w-6xl items-center justify-end px-4 py-1 sm:px-6">
          <HeaderAuthRow className="max-w-full overflow-x-auto whitespace-nowrap sm:w-auto sm:max-w-none sm:overflow-visible" />
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

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2 lg:ml-0">
          <a
            href={instagramHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${HEADER_UTIL_LINK_CLASS} gap-1.5`}
            title="인스타그램"
            aria-label="Bong투어 인스타그램 (새 탭)"
          >
            <InstagramGlyphIcon gradientId={instagramGradientId} />
            <span className="sr-only">인스타그램 (새 탭)</span>
          </a>
          <button
            type="button"
            className="shrink-0 rounded-md border border-bt-border-soft p-2.5 text-bt-title sm:p-3 lg:hidden"
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
              <li key={item.label} className="border-b border-slate-100">
                <Link
                  href={item.href}
                  className="block py-4 text-center text-[17px] font-semibold leading-snug text-bt-title"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-slate-100 last:border-0">
              <a
                href={instagramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-4 text-[17px] font-semibold leading-snug text-bt-title"
                onClick={() => setOpen(false)}
              >
                <InstagramGlyphIcon gradientId={instagramGradientIdMobile} />
                인스타그램
              </a>
            </li>
          </ul>
        </div>
      )}
    </header>
  )
}
