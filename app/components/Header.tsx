'use client'

import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SITE_NAME } from '@/lib/site-metadata'
import { useId } from 'react'
import SafeImage from '@/app/components/SafeImage'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { Phone, User } from 'lucide-react'

const HEADER_TEL_DISPLAY = '031-213-2558'
const HEADER_TEL_HREF = 'tel:0312132558'
const INQUIRY_HREF = '/inquiry?type=travel'

/**
 * 메모리 #28 — 메인 IA 4메뉴.
 * 해외 서브메가는 `OverseasTravelSubMainNav` 유지.
 */
const MAIN_NAV: { label: string; href: string }[] = [
  { label: '해외여행상품', href: '/travel/overseas' },
  { label: '자유여행', href: '/travel/air-hotel' },
  { label: '우리끼리', href: '/travel/overseas/private-trip' },
  { label: '공공·기업', href: '/training' },
]

function isMainNavActive(pathname: string, href: string): boolean {
  if (href === '/travel/overseas') {
    if (pathname === '/travel/overseas') return true
    if (pathname.startsWith('/travel/overseas/') && !pathname.startsWith('/travel/overseas/private-trip')) {
      return true
    }
    return false
  }
  if (href === '/travel/overseas/private-trip') {
    return pathname === href || pathname.startsWith(`${href}/`)
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** 운영 계정 — env 미설정 시에도 헤더에 표시 (NEXT_PUBLIC_INSTAGRAM_URL로 덮어쓰기 가능) */
const DEFAULT_INSTAGRAM_URL = 'https://www.instagram.com/bongtour103'

const instagramHref = (() => {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_INSTAGRAM_URL === 'string' ? process.env.NEXT_PUBLIC_INSTAGRAM_URL.trim() : ''
  return fromEnv || DEFAULT_INSTAGRAM_URL
})()

/** 인스타그램 공식 글리프에 가까운 그라데이션(브랜드 가이드 색상 근사) */
function InstagramGlyphIcon({ gradientId }: { gradientId: string }) {
  return (
    <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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

type HeaderProps = {
  /** 메인 등: 모바일 가로 메뉴(4메뉴 칩 행) 숨김 — 데스크톱 `lg:flex` 내비는 유지 */
  hideMobileNav?: boolean
}

export default function Header({ hideMobileNav = false }: HeaderProps) {
  const pathnameRaw = usePathname()
  const pathname = pathnameRaw ?? ''
  const { data: session, status } = useSession()
  const instagramGradientId = `ig-glyph-${useId().replace(/:/g, '')}`
  const authLoading = status === 'loading'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-bt-border-soft bg-white shadow-sm">
      <div className={SITE_CONTENT_CLASS}>
        <div className="flex min-h-[4.5rem] items-center justify-between gap-3 py-3 sm:min-h-[5rem] sm:py-4">
          <div className="flex min-w-0 shrink-0 flex-col items-start">
            <span className="mb-0.5 pl-1 text-xs leading-none text-bt-text-muted-lavender">simply your</span>
            <Link
              href="/"
              className="relative isolate z-10 inline-flex shrink-0 flex-col overflow-hidden py-0.5"
              aria-label="Bong투어 홈"
              onClick={(e) => {
                try {
                  if (typeof window === 'undefined') return
                  if (window.location.pathname.includes('/travel/esim/checkout/payment/welcomepay')) {
                    e.preventDefault()
                    window.location.assign('/')
                  }
                } catch {
                  /* ignore */
                }
              }}
            >
              <SafeImage
                src="/images/bongtour-logo.webp"
                alt={SITE_NAME}
                width={3200}
                height={1344}
                className="relative z-0 block h-12 w-auto object-contain object-left sm:h-[3.25rem] lg:h-[3.35rem]"
                priority
              />
            </Link>
          </div>

          <nav className="mx-auto hidden min-w-0 flex-1 items-center justify-center gap-6 lg:flex" aria-label="주요 메뉴">
            {MAIN_NAV.map((item) => {
              const active = isMainNavActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap border-b-2 pb-1 text-base font-medium text-bt-text-navy transition-colors ${
                    active ? 'border-bt-brand-gold-strong' : 'border-transparent hover:border-bt-brand-gold-strong'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <a
              href={instagramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md p-2 text-bt-text-navy transition hover:bg-bt-surface-alt"
              title="인스타그램"
              aria-label="Bong투어 인스타그램 (새 탭)"
            >
              <InstagramGlyphIcon gradientId={instagramGradientId} />
              <span className="sr-only">인스타그램 (새 탭)</span>
            </a>

            <div className="hidden items-center gap-3 lg:flex">
              <a
                href={HEADER_TEL_HREF}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-bt-brand-gold-strong hover:opacity-90"
              >
                <Phone className="h-4 w-4 shrink-0" aria-hidden />
                {HEADER_TEL_DISPLAY}
              </a>
              <Link
                href={INQUIRY_HREF}
                className="rounded-full bg-bt-brand-gold-strong px-4 py-2 text-sm font-medium text-white transition hover:opacity-95"
              >
                상담 신청
              </Link>
              {authLoading ? (
                <div className="h-9 w-24 shrink-0 animate-pulse rounded-full bg-bt-border-soft" aria-hidden />
              ) : session?.user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/mypage"
                    className="rounded-full border-[0.5px] border-bt-border-strong px-4 py-2 text-sm font-medium text-bt-text-muted-lavender transition hover:bg-bt-surface-soft"
                  >
                    마이페이지
                  </Link>
                  <button
                    type="button"
                    onClick={() => void signOut({ callbackUrl: '/' })}
                    className="text-sm text-bt-text-muted-lavender underline-offset-2 hover:underline"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
                <Link
                  href="/auth/signin"
                  className="rounded-full border-[0.5px] border-bt-border-strong px-4 py-2 text-sm font-medium text-bt-text-muted-lavender transition hover:bg-bt-surface-soft"
                >
                  로그인
                </Link>
              )}
            </div>

            <div className="flex items-center gap-1 lg:hidden">
              <Link
                href={INQUIRY_HREF}
                className="shrink-0 rounded-full bg-bt-brand-gold-strong px-2.5 py-1 text-xs font-medium text-white"
              >
                상담
              </Link>
              <a
                href={HEADER_TEL_HREF}
                className="shrink-0 p-1.5 text-bt-brand-gold-strong"
                aria-label={`전화 ${HEADER_TEL_DISPLAY}`}
              >
                <Phone className="h-5 w-5" aria-hidden />
              </a>
              {authLoading ? (
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-bt-border-soft" aria-hidden />
              ) : session?.user ? (
                <Link href="/mypage" className="shrink-0 p-1.5 text-bt-text-navy" aria-label="마이페이지">
                  <User className="h-5 w-5" aria-hidden />
                </Link>
              ) : (
                <Link href="/auth/signin" className="shrink-0 p-1.5 text-bt-text-navy" aria-label="로그인">
                  <User className="h-5 w-5" aria-hidden />
                </Link>
              )}
            </div>
          </div>
        </div>

        {!hideMobileNav ? (
          <nav
            className="-mx-4 flex gap-1 overflow-x-auto whitespace-nowrap border-t border-bt-border-soft/70 px-4 py-2.5 sm:-mx-6 sm:px-6 lg:hidden"
            aria-label="주요 메뉴"
          >
            {MAIN_NAV.map((item) => {
              const active = isMainNavActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-full px-2.5 py-1.5 text-base font-medium transition-colors ${
                    active
                      ? 'border-2 border-bt-brand-gold-strong bg-bt-surface-soft text-bt-text-navy'
                      : 'border border-bt-border-soft bg-bt-surface-alt text-bt-text-navy hover:border-bt-brand-gold-strong/60'
                  }`}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>
        ) : null}
      </div>
    </header>
  )
}
