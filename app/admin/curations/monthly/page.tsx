import { redirect } from 'next/navigation'

type Search = Record<string, string | string[] | undefined>

/** 북마크·필터 쿼리 — 통합 큐레이션의 항목 편집 탭. 기존 쿼리는 유지한다. */
export default async function AdminMonthlyCurationsPage({
  searchParams,
}: {
  searchParams?: Promise<Search>
}) {
  const sp = (await searchParams) ?? {}
  const q = new URLSearchParams()
  q.set('tab', 'items')
  for (const [key, value] of Object.entries(sp)) {
    if (key === 'tab' || value == null) continue
    q.set(key, Array.isArray(value) ? value[0] ?? '' : value)
  }
  redirect(`/admin/season-curation?${q.toString()}`)
}
