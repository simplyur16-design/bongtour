import { redirect } from 'next/navigation'

type Search = Record<string, string | string[] | undefined>

/** 북마크 — 통합 큐레이션의 이벤트 후보 탭. status 쿼리는 유지한다. */
export default async function CurationEventsAdminPage({
  searchParams,
}: {
  searchParams?: Promise<Search>
}) {
  const sp = (await searchParams) ?? {}
  const q = new URLSearchParams()
  q.set('tab', 'events')
  for (const [key, value] of Object.entries(sp)) {
    if (key === 'tab' || value == null) continue
    q.set(key, Array.isArray(value) ? value[0] ?? '' : value)
  }
  redirect(`/admin/season-curation?${q.toString()}`)
}
