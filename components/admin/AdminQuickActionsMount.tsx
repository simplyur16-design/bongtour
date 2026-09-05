'use client'

import { usePathname } from 'next/navigation'
import AdminQuickActions from '@/components/admin/AdminQuickActions'
import { shouldHideMobileStickyBar } from '@/lib/mobile-sticky-bar-visibility'

/** 루트 레이아웃용 — 관리자 세션일 때만 UI 표시. simplyur·admin·이심 결제 퍼널 제외. */
// REGRESSION-FREEZE[esim-mobile-web-pay-dock]: FAB must not cover 결제하기 — manifest
export default function AdminQuickActionsMount() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/admin') || shouldHideMobileStickyBar(pathname)) return null
  return <AdminQuickActions />
}
