'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
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
} from 'lucide-react'

type NavLink = { href: string; label: string; icon: LucideIcon }
type NavEntry =
  | { type: 'link'; href: string; label: string; icon: LucideIcon }
  | { type: 'group'; label: string; items: NavLink[] }

const navEntries: NavEntry[] = [
  { type: 'link', href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { type: 'link', href: '/admin/members', label: '회원 관리', icon: Users },
  { type: 'link', href: '/admin/home-hub-card-images', label: '메인 허브 이미지', icon: Images },
  { type: 'link', href: '/admin/og-images', label: 'OG 이미지 (공유)', icon: Share2 },
  { type: 'link', href: '/admin/image-assets-upload', label: '이미지 업로드 · 출처(iStock)', icon: Images },
  { type: 'link', href: '/admin/bongsim/country-heroes', label: '봉심 eSIM 국가 히어로', icon: Smartphone },
  {
    type: 'group',
    label: 'eSIM 관리',
    items: [
      { href: '/admin/bongsim/coupons', label: '쿠폰 관리', icon: Ticket },
      { href: '/admin/bongsim/coupon-report', label: '할인 리포트', icon: BarChart3 },
      { href: '/admin/bongsim/payments', label: '결제 내역', icon: CreditCard },
      { href: '/admin/bongsim/products', label: '상품 관리', icon: Package },
      { href: '/admin/bongsim/monthly-curation', label: '월별 큐레이션(Gemini)', icon: CalendarDays },
    ],
  },
  { type: 'link', href: '/admin/register', label: '상품 등록', icon: Package },
  { type: 'link', href: '/admin/pending', label: '등록대기', icon: ClipboardList },
  { type: 'link', href: '/admin/products', label: '상품 목록', icon: List },
  { type: 'link', href: '/admin/overseas-content', label: '해외 콘텐츠 CMS', icon: CalendarDays },
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
}: {
  href: string
  label: string
  Icon: LucideIcon
  pathname: string
  collapsed: boolean
}) {
  const isActive = pathname === href || (href !== '/admin' && pathname?.startsWith(href))
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
        isActive
          ? 'bg-bt-brand-blue-soft text-bt-title'
          : 'text-bt-inverse/65 hover:bg-white/10 hover:text-bt-inverse'
      }`}
      title={collapsed ? label : undefined}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  )
}

export default function AdminSidebar() {
  const pathname = usePathname() ?? ''
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-bt-border-strong bg-bt-title text-bt-inverse transition-[width] duration-200 ${
        collapsed ? 'w-[56px]' : 'w-56'
      }`}
    >
      <div className="flex h-14 items-center justify-between border-b border-white/10 px-3">
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-bt-inverse">Bong투어 관리</span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1.5 text-bt-inverse/60 hover:bg-white/10 hover:text-bt-inverse"
          aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <ChevronLeft className="h-5 w-5" />
          )}
        </button>
      </div>
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
              />
            )
          }
          return (
            <div key={`group-${entry.label}-${idx}`} className="mt-2 flex flex-col gap-0.5 first:mt-0">
              {!collapsed && (
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-bt-inverse/40">
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
                />
              ))}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
