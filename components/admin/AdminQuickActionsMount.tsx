'use client'

import { usePathname } from 'next/navigation'
import AdminQuickActions from '@/components/admin/AdminQuickActions'

/** 루트 레이아웃용 — 관리자 세션일 때만 UI 표시. simplyur·admin 경로 제외. */
export default function AdminQuickActionsMount() {
  const pathname = usePathname() ?? ''
  if (pathname.startsWith('/simplyur') || pathname.startsWith('/admin')) return null
  return <AdminQuickActions />
}
