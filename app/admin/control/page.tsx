import { redirect } from 'next/navigation'

/**
 * 이전 제어 대시보드는 /admin(대시보드)으로 통합됨.
 * /admin/control 접속 시 대시보드로 리다이렉트.
 */
export default function AdminControlPage() {
  redirect('/admin')
}
