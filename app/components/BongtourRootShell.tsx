'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import UtmCaptureProvider from '@/components/UtmCaptureProvider'
import AntiCopyProtectionGate from './AntiCopyProtectionGate'
import ConditionalSiteFooter from './ConditionalSiteFooter'
import GoogleTagManager from './GoogleTagManager'
import MobileStickyBar from './MobileStickyBar'
import AdminQuickActionsMount from '@/components/admin/AdminQuickActionsMount'
import BongtourPretendardStyles from './BongtourPretendardStyles'
import { isSimplyurSurfacePath } from '@/lib/surface/simplyur-surface'

/**
 * 루트 layout이 headers() 없이 ISR/CDN을 쓰도록 — simplyur는 path로 크롬 제외.
 * html lang/data-surface는 layout 인라인 스크립트가 first paint 전에 보정.
 */
export default function BongtourRootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '/'
  if (isSimplyurSurfacePath(pathname)) {
    return <div className="flex-1 flex flex-col">{children}</div>
  }

  return (
    <>
      <AntiCopyProtectionGate />
      <GoogleTagManager />
      <BongtourPretendardStyles />
      <UtmCaptureProvider>
        <div className="flex-1 flex flex-col">{children}</div>
        <ConditionalSiteFooter />
        <MobileStickyBar />
        <AdminQuickActionsMount />
      </UtmCaptureProvider>
    </>
  )
}
