import { redirect } from 'next/navigation'
import { getAdminSession, MOCK_ADMIN_SESSION_ID } from '@/lib/get-admin-session'
import AdminSidebar from './components/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getAdminSession()
  if (!session?.user && process.env.NODE_ENV === 'production') {
    redirect('/auth/signin')
  }
  // development: BONGTOUR_DEV_ADMIN_BYPASS=true + ALLOW_MOCK_ADMIN=true 일 때만 mock 반환. 배너로 표시.
  const isDevMock = process.env.NODE_ENV === 'development' && (session?.user as { id?: string })?.id === MOCK_ADMIN_SESSION_ID

  return (
    <div className="flex min-h-screen bg-bt-surface-soft text-bt-body">
      {isDevMock && (
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-200">
          [개발] 임시 관리자 모드 (세션 없음, 카카오 승인 대기 중)
        </div>
      )}
      <AdminSidebar />
      <main className="flex-1 min-h-screen overflow-auto bg-bt-surface-soft px-4 pb-8 pt-4 sm:px-6">{children}</main>
    </div>
  )
}
