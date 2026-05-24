'use client'

import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SITE_NAME } from '@/lib/site-metadata'
import SafeImage from '@/app/components/SafeImage'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { User } from 'lucide-react'

const INQUIRY_HREF = '/inquiry?type=travel'

/** 무거운 RSC·browse API 라우트 — viewport prefetch로 전환 지연 유발 방지 */
const HEAVY_NAV_PREFETCH_OFF = new Set([
  '/travel/overseas',
  '/travel/air-hotel',
  '/travel/esim',
  '/travel/overseas/private-trip',
  '/business',
])

/**
 * 메모리 #28 — 메인 IA 5메뉴.
 * 해외 권역 메가메뉴는 `/travel/overseas` 페이지 `OverseasRegionMegaNav` 전용.
 */
export const MAIN_NAV: { label: string; mobileLabel?: string; href: string }[] = [
  { label: '해외여행상품', mobileLabel: '해외여행', href: '/travel/overseas' },
  { label: '자유여행', href: '/travel/air-hotel' },
  { label: 'eSIM', href: '/travel/esim' },
  { label: '우리끼리', href: '/travel/overseas/private-trip' },
  { label: '공공·기업', href: '/business' },
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
  if (href === '/travel/esim') {
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

/** 문서 내 고정 id — `useId`는 오버레이·스트리밍 시 SSR/CSR 순서가 어긋날 수 있음 */
const INSTAGRAM_GLYPH_GRADIENT_ID = 'bongtour-header-ig-glyph'

/** 인스타그램 공식 글리프에 가까운 그라데이션(브랜드 가이드 색상 근사) */
function InstagramGlyphIcon({ className = 'h-7 w-7 sm:h-6 sm:w-6' }: { className?: string }) {
  const gradientId = INSTAGRAM_GLYPH_GRADIENT_ID
  return (
    <svg className={`shrink-0 ${className}`} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
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
  /** 메인 등: 모바일 가로 메뉴(5메뉴 칩 행) 숨김 — 데스크톱 `lg:flex` 내비는 유지 */
  hideMobileNav?: boolean
}

export default function Header({ hideMobileNav = false }: HeaderProps) {
  const pathnameRaw = usePathname()
  const pathname = pathnameRaw ?? ''
  const { data: session, status } = useSession()
  const authLoading = status === 'loading'

  return (
    <header className="sticky top-0 z-50 w-full border-b border-bt-border-soft bg-white shadow-sm">
      <div className={`${SITE_CONTENT_CLASS} pb-0`}>
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
                width={274}
                height={78}
                className="relative z-0 block h-12 w-auto max-h-12 object-contain object-left sm:h-[3.25rem] sm:max-h-[3.25rem] lg:h-[3.35rem] lg:max-h-[3.35rem]"
                priority
              />
            </Link>
          </div>

          <nav className="mx-auto hidden min-w-0 flex-1 items-center justify-center gap-5 xl:gap-6 lg:flex" aria-label="주요 메뉴">
            {MAIN_NAV.map((item) => {
              const active = isMainNavActive(pathname, item.href)
              const prefetch = !HEAVY_NAV_PREFETCH_OFF.has(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={prefetch}
                  aria-current={active ? 'page' : undefined}
                  className={`whitespace-nowrap pb-1 text-bt-text-navy ${
                    active
                      ? 'text-lg font-bold sm:text-[1.125rem]'
                      : 'text-base font-medium'
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
              <InstagramGlyphIcon />
              <span className="sr-only">인스타그램 (새 탭)</span>
            </a>

            <div className="hidden items-center gap-3 lg:flex">
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
                    prefetch={false}
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

            <div className="flex items-center gap-2 lg:hidden">
              <Link
                href={INQUIRY_HREF}
                className="shrink-0 rounded-full bg-bt-brand-gold-strong px-3.5 py-2 text-sm font-semibold text-white"
              >
                상담
              </Link>
              {authLoading ? (
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-bt-border-soft" aria-hidden />
              ) : session?.user ? (
                <Link
                  href="/mypage"
                  prefetch={false}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-bt-border-soft px-2.5 py-1.5 text-sm font-semibold text-bt-text-navy"
                  aria-label="마이페이지"
                >
                  <User className="h-6 w-6" aria-hidden />
                  <span className="max-[380px]:hidden">마이</span>
                </Link>
              ) : (
                <Link
                  href="/auth/signin"
                  className="inline-flex shrink-0 items-center gap-1 rounded-full border border-bt-border-soft px-2.5 py-1.5 text-sm font-semibold text-bt-text-navy"
                  aria-label="로그인"
                >
                  <User className="h-6 w-6" aria-hidden />
                  <span className="max-[380px]:hidden">로그인</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {!hideMobileNav ? (
        <div className="w-full border-t border-bt-border-soft/70 lg:hidden">
          <nav
            className={`${SITE_CONTENT_CLASS} grid w-full grid-cols-5 py-2.5 sm:py-3`}
            aria-label="주요 메뉴"
          >
            {MAIN_NAV.map((item) => {
              const active = isMainNavActive(pathname, item.href)
              const mobileText = item.mobileLabel ?? item.label
              const prefetch = !HEAVY_NAV_PREFETCH_OFF.has(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={prefetch}
                  title={item.label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex w-full items-center justify-center whitespace-nowrap px-0.5 py-2 text-center text-[12px] leading-tight min-[380px]:text-[13px] sm:text-[14px] ${
                    active
                      ? 'font-bold text-bt-text-navy'
                      : 'font-medium text-bt-text-navy'
                  }`}
                >
                  {mobileText}
                </Link>
              )
            })}
          </nav>
        </div>
      ) : null}
    </header>
  )
}
