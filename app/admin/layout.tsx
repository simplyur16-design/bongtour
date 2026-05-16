import { redirect } from 'next/navigation'
import { getAdminSession, MOCK_ADMIN_SESSION_ID } from '@/lib/get-admin-session'
import { ADMIN_MAIN_CLASS, ADMIN_SHELL_CLASS } from '@/lib/admin-design-system'
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
  const isDevMock =
    process.env.NODE_ENV === 'development' && (session?.user as { id?: string })?.id === MOCK_ADMIN_SESSION_ID

  return (
    <div className={ADMIN_SHELL_CLASS}>
      {isDevMock && (
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-xs font-medium text-amber-200">
          [개발] 임시 관리자 모드 (세션 없음, 카카오 승인 대기 중)
        </div>
      )}
      <AdminSidebar />
      <main className={ADMIN_MAIN_CLASS}>{children}</main>
    </div>
  )
}
