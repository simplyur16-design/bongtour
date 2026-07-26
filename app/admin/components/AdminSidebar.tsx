'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ADMIN_NAV_ACTIVE_CLASS,
  ADMIN_NAV_IDLE_CLASS,
  ADMIN_SIDEBAR_CLASS,
  ADMIN_SIDEBAR_HEADER_CLASS,
} from '@/lib/admin-design-system'
import {
  LayoutDashboard,
  Package,
  List,
  Settings,
  ClipboardList,
  MessageCircle,
  Inbox,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Images,
  Users,
  Star,
  Share2,
  Smartphone,
  Ticket,
  BarChart3,
  CreditCard,
  IdCard,
  ShieldCheck,
  Megaphone,
  Plane,
  MapPin,
  Trash2,
  Sparkles,
  Quote,
  Link2,
  LineChart,
  Menu,
  X,
} from 'lucide-react'

type NavLink = { href: string; label: string; icon: LucideIcon }
type NavEntry =
  | { type: 'link'; href: string; label: string; icon: LucideIcon }
  | { type: 'group'; label: string; items: NavLink[] }

const navEntries: NavEntry[] = [
  { type: 'link', href: '/admin', label: '대시보드', icon: LayoutDashboard },
  /** 최상단 노출 — eSIM 그룹 안에만 두면 스크롤·접힘에 묻힘 */
  {
    type: 'link',
    href: '/admin/bongsim/affiliation-cards',
    label: '소속 명함 승인',
    icon: IdCard,
  },
  { type: 'link', href: '/admin/members', label: '회원 관리', icon: Users },
  { type: 'link', href: '/admin/staff', label: '직원 권한 관리', icon: ShieldCheck },
  { type: 'link', href: '/admin/home-hub-card-images', label: '메인 허브 이미지', icon: Images },
  { type: 'link', href: '/admin/og-images', label: 'OG 이미지 (공유)', icon: Share2 },
  {
    type: 'group',
    label: '마케팅',
    items: [
      { href: '/admin/marketing', label: '개요', icon: Megaphone },
      { href: '/admin/marketing/packages', label: '패키지', icon: Package },
      { href: '/admin/marketing/airtel', label: '자유여행', icon: Plane },
      { href: '/admin/marketing/trip-recommendations', label: '콘텐츠 자동화', icon: Sparkles },
      { href: '/admin/marketing/curation-events', label: '이벤트 검토 (임시)', icon: CalendarDays },
      { href: '/admin/marketing/hooks', label: '후킹 라이브러리', icon: Quote },
      { href: '/admin/marketing/integrations', label: '외부 연동 (Meta)', icon: Link2 },
      { href: '/admin/marketing/insights', label: '인사이트', icon: LineChart },
    ],
  },
  { type: 'link', href: '/admin/image-assets-upload', label: '이미지 업로드 · 출처(iStock)', icon: Images },
  { type: 'link', href: '/admin/bongsim/country-heroes', label: '봉심 eSIM 국가 히어로', icon: Smartphone },
  {
    type: 'group',
    label: 'eSIM 관리',
    items: [
      { href: '/admin/bongsim/affiliation-cards', label: '소속 명함 승인', icon: IdCard },
      { href: '/admin/bongsim/coupons', label: '쿠폰 관리', icon: Ticket },
      { href: '/admin/bongsim/coupon-report', label: '할인 리포트', icon: BarChart3 },
      { href: '/admin/bongsim/payments', label: '결제 내역', icon: CreditCard },
      { href: '/admin/bongsim/products', label: '상품 관리', icon: Package },
      { href: '/admin/bongsim/monthly-curation', label: '월별 큐레이션(Gemini)', icon: CalendarDays },
    ],
  },
  {
    type: 'group',
    label: '국외연수 프로그램',
    items: [
      { href: '/admin/training-programs', label: '프로그램 목록', icon: List },
      { href: '/admin/training-programs/new', label: '프로그램 등록', icon: Package },
      { href: '/admin/training-programs/guide', label: '운영 가이드', icon: ClipboardList },
    ],
  },
  { type: 'link', href: '/admin/register', label: '상품 등록', icon: Package },
  { type: 'link', href: '/admin/pending', label: '등록대기', icon: ClipboardList },
  { type: 'link', href: '/admin/products', label: '상품 목록', icon: List },
  { type: 'link', href: '/admin/products/geo-audit', label: '상품 지리 검수', icon: MapPin },
  { type: 'link', href: '/admin/products/master-integrity', label: '마스터 정합', icon: ShieldCheck },
  {
    type: 'link',
    href: '/admin/products/six-month-purge-recommendations',
    label: '6개월 미가격 삭제 권고',
    icon: Trash2,
  },
  { type: 'link', href: '/admin/season-curation', label: '시즌 추천 여행지', icon: MapPin },
  { type: 'link', href: '/admin/registration-stats', label: '등록 현황', icon: BarChart3 },
  { type: 'link', href: '/admin/inquiries', label: '문의 접수', icon: Inbox },
  { type: 'link', href: '/admin/reviews', label: '회원 여행 후기', icon: Star },
  { type: 'link', href: '/admin/bookings', label: '상담·예약', icon: MessageCircle },
  { type: 'link', href: '/admin/scheduler-settings', label: '스케줄러·보안', icon: Settings },
]

function NavItemLink({
  href,
  label,
  Icon,
  pathname,
  collapsed,
  onNavigate,
}: {
  href: string
  label: string
  Icon: LucideIcon
  pathname: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  const isActive =
    pathname === href ||
    (href !== '/admin' &&
      href !== '/admin/marketing' &&
      !!pathname &&
      (pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`)))
  return (
    <Link
      href={href}
      onClick={() => onNavigate?.()}
      className={`flex items-center gap-3 rounded-lg py-2.5 pr-3 text-sm transition-colors ${
        isActive ? ADMIN_NAV_ACTIVE_CLASS : ADMIN_NAV_IDLE_CLASS
      }`}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

function SidebarNav({
  pathname,
  collapsed,
  onNavigate,
}: {
  pathname: string
  collapsed: boolean
  onNavigate?: () => void
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {navEntries.map((entry, idx) => {
        if (entry.type === 'link') {
          return (
            <NavItemLink
              key={entry.href}
              href={entry.href}
              label={entry.label}
              Icon={entry.icon}
              pathname={pathname}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          )
        }
        return (
          <div key={`group-${entry.label}-${idx}`} className="mt-2 flex flex-col gap-0.5 first:mt-0">
            {!collapsed && (
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-white/40">
                {entry.label}
              </div>
            )}
            {entry.items.map((item) => (
              <NavItemLink
                key={item.href}
                href={item.href}
                label={item.label}
                Icon={item.icon}
                pathname={pathname}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )
      })}
    </nav>
  )
}

/** REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: admin mobile drawer shell — manifest */
export default function AdminSidebar() {
  const pathname = usePathname() ?? ''
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  if (!mounted) {
    return (
      <>
        <div className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-white/10 bg-bt-text-navy px-3 md:hidden">
          <span className="h-9 w-9" />
          <span className="text-sm font-semibold text-white">Bong투어 관리</span>
        </div>
        <aside className={`${ADMIN_SIDEBAR_CLASS} hidden w-56 md:flex`} aria-hidden="true">
          <div className={ADMIN_SIDEBAR_HEADER_CLASS}>
            <span className="truncate text-sm font-semibold text-white">Bong투어 관리</span>
            <span className="h-8 w-8 shrink-0" />
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" />
        </aside>
      </>
    )
  }

  return (
    <>
      {/* 모바일 상단바 */}
      <header
        className="sticky top-0 z-40 flex h-12 items-center gap-2 border-b border-white/10 bg-bt-text-navy px-3 md:hidden"
        data-admin-mobile-bar="true"
      >
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white hover:bg-white/10"
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">Bong투어 관리</span>
        <Link
          href="/admin/bongsim/affiliation-cards"
          className="shrink-0 rounded-lg bg-bt-brand-gold-strong px-2.5 py-1.5 text-xs font-semibold text-bt-text-navy"
        >
          소속 명함 승인
        </Link>
      </header>

      {/* 모바일 드로어 */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" data-admin-mobile-drawer="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
          />
          <aside className={`${ADMIN_SIDEBAR_CLASS} absolute inset-y-0 left-0 w-[min(18rem,88vw)] shadow-xl`}>
            <div className={ADMIN_SIDEBAR_HEADER_CLASS}>
              <span className="truncate text-sm font-semibold text-white">Bong투어 관리</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                aria-label="메뉴 닫기"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav
              pathname={pathname}
              collapsed={false}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      {/* 데스크톱 사이드바 */}
      <aside className={`${ADMIN_SIDEBAR_CLASS} hidden ${collapsed ? 'w-[56px]' : 'w-56'} md:flex`}>
        <div className={ADMIN_SIDEBAR_HEADER_CLASS}>
          {!collapsed && (
            <span className="truncate text-sm font-semibold text-white">Bong투어 관리</span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>
        </div>
        <SidebarNav pathname={pathname} collapsed={collapsed} />
      </aside>
    </>
  )
}
