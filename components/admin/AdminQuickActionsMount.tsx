'use client'

import dynamic from 'next/dynamic'

const AdminQuickActions = dynamic(() => import('@/components/admin/AdminQuickActions'), { ssr: false })

/** 루트 레이아웃용 — 클라이언트 전용, 공개 페이지 캐시·SSR 무영향 */
export default function AdminQuickActionsMount() {
  return <AdminQuickActions />
}
