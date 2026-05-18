import { redirect } from 'next/navigation'

/** 통합됨 — 시즌 추천 여행지·월별 큐레이션으로 이전 */
export default function AdminOverseasContentRedirectPage() {
  redirect('/admin/season-curation')
}
