import { redirect } from 'next/navigation'

/** 북마크 — 통합 큐레이션의 월별 탭 */
export default function AdminMonthlyCurationGeneratePage() {
  redirect('/admin/season-curation?tab=monthly')
}
