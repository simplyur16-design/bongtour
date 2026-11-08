import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { requireAdmin } from '@/lib/require-admin'
import OverseasContentAdminClient from '@/app/admin/overseas-content/OverseasContentAdminClient'
import MonthlyCurationGenerateClient from '@/app/admin/bongsim/monthly-curation/MonthlyCurationGenerateClient'
import MonthlyCurationsPageClient from '@/app/admin/curations/monthly/MonthlyCurationsPageClient'
import CurationEventsAdminClient from '@/app/admin/marketing/components/CurationEventsAdminClient'
import SeasonCurationAdminClient from './SeasonCurationAdminClient'

const TABS = [
  { id: 'season', label: '시즌 추천' },
  { id: 'monthly', label: '월별 큐레이션' },
  { id: 'items', label: '월별 큐레이션 항목 편집' },
  { id: 'events', label: '이벤트 후보' },
] as const

type TabId = (typeof TABS)[number]['id']

function parseTab(raw: string | undefined): TabId {
  if (raw === 'monthly' || raw === 'items' || raw === 'events') return raw
  return 'season'
}

export default async function AdminSeasonCurationPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/season-curation')

  const tab = parseTab((await searchParams)?.tab)

  return (
    <div className="space-y-6">
      <nav aria-label="큐레이션 구분" className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const active = item.id === tab
          const href = item.id === 'season' ? '/admin/season-curation' : `/admin/season-curation?tab=${item.id}`
          return (
            <Link
              key={item.id}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'rounded-full bg-bt-brand-blue px-3 py-1.5 text-sm font-medium text-white'
                  : 'rounded-full bg-bt-surface-soft px-3 py-1.5 text-sm text-bt-body hover:bg-bt-border-strong/30'
              }
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {tab === 'season' ? (
        <div className="space-y-10">
          <SeasonCurationAdminClient />
          <OverseasContentAdminClient view="editorial" />
        </div>
      ) : null}

      {tab === 'monthly' ? (
        <div className="space-y-10">
          <Suspense fallback={<p className="p-6 text-sm text-bt-muted">불러오는 중…</p>}>
            <MonthlyCurationGenerateClient />
          </Suspense>
          <OverseasContentAdminClient view="monthly" />
        </div>
      ) : null}

      {tab === 'items' ? (
        <Suspense
          fallback={
            <div className="flex min-h-[40vh] items-center justify-center bg-gray-50 text-sm text-gray-500">
              로딩 중…
            </div>
          }
        >
          <MonthlyCurationsPageClient />
        </Suspense>
      ) : null}

      {tab === 'events' ? (
        <div className="mx-auto max-w-6xl p-4">
          <Suspense fallback={<p className="text-sm text-bt-body/70">불러오는 중…</p>}>
            <CurationEventsAdminClient />
          </Suspense>
        </div>
      ) : null}
    </div>
  )
}
