import Link from 'next/link'
import type { BongContentStatus } from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const STATUSES = ['draft', 'approved', 'scheduled', 'published', 'rejected'] as const

const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  draft: '드래프트',
  approved: '검수 완료',
  scheduled: '게시 예약',
  published: '게시 완료',
  rejected: '거절',
}

export default async function MarketingDashboardPage() {
  type GroupRow = { contentTrack: string; status: BongContentStatus; _count: { id: number } }
  let rows: GroupRow[] = []
  let migrationPending = false
  try {
    const data = await prisma.bongBlogPost.groupBy({
      by: ['contentTrack', 'status'],
      _count: { id: true },
    })
    rows = data as GroupRow[]
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2022') {
      rows = []
      migrationPending = true
    } else {
      throw e
    }
  }

  function cell(track: 'package' | 'airtel', status: (typeof STATUSES)[number]) {
    const hit = rows.find((r) => r.contentTrack === track && r.status === status)
    return hit?._count.id ?? 0
  }

  function rowSum(track: 'package' | 'airtel') {
    return STATUSES.reduce((a, s) => a + cell(track, s), 0)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-bt-title">마케팅</h1>
        <p className="mt-1 text-sm text-bt-body/70">
          네이버 블로그 초안(BongBlogPost) — 패키지(travel/semi)와 자유여행(airtel/private) 채널
        </p>
        {migrationPending && (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            DB에 `contentTrack` 등 B-CRUD-1 마이그레이션이 아직 적용되지 않았습니다. Supabase MCP로 마이그레이션 SQL 적용 후 새로고침하세요.
          </p>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <DashboardCard
          title="패키지 마케팅"
          href="/admin/marketing/packages"
          total={rowSum('package')}
          counts={STATUSES.map((s) => ({ status: s, label: STATUS_LABEL[s], n: cell('package', s) }))}
        />
        <DashboardCard
          title="자유여행 마케팅"
          href="/admin/marketing/airtel"
          total={rowSum('airtel')}
          counts={STATUSES.map((s) => ({ status: s, label: STATUS_LABEL[s], n: cell('airtel', s) }))}
        />
      </div>
    </div>
  )
}

function DashboardCard(props: {
  title: string
  href: string
  total: number
  counts: { status: string; label: string; n: number }[]
}) {
  const { title, href, total, counts } = props
  return (
    <div className="rounded-xl border border-bt-border-strong bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-bt-title">{title}</h2>
          <p className="mt-1 text-sm text-bt-body/70">전체 {total}건</p>
        </div>
        <Link
          href={href}
          className="shrink-0 rounded-lg bg-bt-brand-blue px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
        >
          목록 →
        </Link>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {counts.map((c) => (
          <li key={c.status} className="flex justify-between border-b border-bt-border-strong/60 py-1.5 last:border-0">
            <span className="text-bt-body/80">{c.label}</span>
            <span className="font-medium text-bt-title">{c.n}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
