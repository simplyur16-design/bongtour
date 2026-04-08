'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
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
} from 'lucide-react'

const nav = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/members', label: '회원 관리', icon: Users },
  { href: '/admin/home-hub-card-images', label: '메인 허브 이미지', icon: Images },
  { href: '/admin/image-assets-upload', label: '이미지 업로드 · 출처(iStock)', icon: Images },
  { href: '/admin/register', label: '상품 등록', icon: Package },
  { href: '/admin/pending', label: '등록대기', icon: ClipboardList },
  { href: '/admin/products', label: '상품 목록', icon: List },
  { href: '/admin/curations/monthly', label: '월별 큐레이션', icon: CalendarDays },
  { href: '/admin/overseas-content', label: '해외 콘텐츠 CMS', icon: CalendarDays },
  { href: '/admin/inquiries', label: '문의 접수', icon: Inbox },
  { href: '/admin/reviews', label: '회원 여행 후기', icon: Star },
  { href: '/admin/bookings', label: '상담·예약', icon: MessageCircle },
  { href: '/admin/scheduler-settings', label: '스케줄러·보안', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()
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
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname?.startsWith(href))
          return (
            <Link
              key={href}
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
        })}
      </nav>
    </aside>
  )
}
