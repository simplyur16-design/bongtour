import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import {
  countActiveHubImages,
  getHomeHubActiveFile,
  getResolvedActiveSeason,
} from '@/lib/home-hub-resolve-images'
import type { HomeHubActiveClientModel } from '@/lib/home-hub-active-client-model'
import { HomeHubCardImagesWorkspace } from './HomeHubCardImagesWorkspace'

function toClientActiveModel(cfg: NonNullable<ReturnType<typeof getHomeHubActiveFile>>): HomeHubActiveClientModel {
  return {
    activeSeason: cfg.activeSeason,
    season: cfg.season,
    lastUpdatedAt: cfg.lastUpdatedAt,
    lastUpdatedBy: cfg.lastUpdatedBy,
    images: cfg.images,
  }
}

export default async function AdminHomeHubCardImagesPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/home-hub-card-images')

  const cfg = getHomeHubActiveFile()
  const activeSeason = getResolvedActiveSeason()
  const activeCount = countActiveHubImages(cfg)
  const lastAt = cfg?.lastUpdatedAt
    ? new Date(cfg.lastUpdatedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
    : '—'
  const initialActive: HomeHubActiveClientModel | null = cfg ? toClientActiveModel(cfg) : null

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 text-slate-100">
      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">메인 허브 이미지 관리</h1>
            <p className="mt-1 text-sm text-slate-400">
              메인 4개 허브 배경을 제미나이로 생성·선택합니다. 사용자 페이지 로드 시 자동 생성하지 않습니다.
            </p>
          </div>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-slate-600 px-3 py-1.5 text-center text-xs font-medium text-teal-300 hover:border-teal-500/60 hover:bg-slate-800/80"
          >
            메인에서 보기
          </a>
        </div>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-500">활성 시즌</dt>
            <dd className="font-medium text-teal-300">{activeSeason}</dd>
          </div>
          <div>
            <dt className="text-slate-500">활성 카드</dt>
            <dd className="font-medium text-slate-200">
              {activeCount}/4
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">마지막 반영</dt>
            <dd className="font-medium text-slate-200">{lastAt}</dd>
          </div>
        </dl>
      </div>

      <p className="mb-6 text-xs font-mono text-slate-500">
        활성: public/data/home-hub-active.json · 후보: public/data/home-hub-candidates.json
      </p>

      <HomeHubCardImagesWorkspace initialActive={initialActive} />

      <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-400">
        <p>
          문서: <code className="text-slate-300">docs/ADMIN-HOME-HUB-IMAGES-UI.md</code> ·{' '}
          <code className="text-slate-300">docs/HOME-HUB-CARD-IMAGES.md</code>
        </p>
      </section>
    </div>
  )
}
