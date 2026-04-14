import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/require-admin'
import {
  countActiveHubImages,
  getHomeHubActiveFile,
  getResolvedActiveSeason,
} from '@/lib/home-hub-resolve-images'
import { homeHubActiveFileToClientModel } from '@/lib/home-hub-active-client-model'
import { HomeHubCardImagesWorkspace } from './HomeHubCardImagesWorkspace'
import { pickHomeHubTravelCardCover } from '@/lib/home-hub-travel-card-cover'
export default async function AdminHomeHubCardImagesPage() {
  const session = await requireAdmin()
  if (!session) redirect('/auth/signin?callbackUrl=/admin/home-hub-card-images')

  const cfg = getHomeHubActiveFile()
  const activeSeason = getResolvedActiveSeason()
  const activeCount = countActiveHubImages(cfg)
  const lastAt = cfg?.lastUpdatedAt
    ? new Date(cfg.lastUpdatedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })
    : '—'
  const initialActive = cfg ? homeHubActiveFileToClientModel(cfg) : null
  const overPool = await pickHomeHubTravelCardCover('overseas')
  const domPool = await pickHomeHubTravelCardCover('domestic')
  const initialTravelPoolPreview = {
    overseas: overPool?.imageSrc ?? null,
    domestic: domPool?.imageSrc ?? null,
  }
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

      <div className="mb-6 space-y-2 text-xs leading-relaxed text-slate-500">
        <p className="font-mono">
          메타데이터(서버 소량 디스크): <code className="text-slate-400">public/data/home-hub-active.json</code> ·{' '}
          <code className="text-slate-400">public/data/home-hub-candidates.json</code>
        </p>
        <p>
          <span className="font-mono text-slate-400">4허브 배경</span> 픽셀 데이터는{' '}
          <strong className="font-medium text-slate-300">Supabase Storage</strong>에만 저장됩니다. 생성 API는{' '}
          <code className="text-slate-400">SUPABASE_URL</code>·<code className="text-slate-400">SUPABASE_SERVICE_ROLE_KEY</code>가
          없으면 동작하지 않으며, 업로드 전에 서버에서 WebP로 변환·리사이즈(대략 가로 2400px 이하, 품질 82)합니다. 활성·후보 JSON에는{' '}
          <span className="text-slate-400">공개 URL 문자열</span>만 들어갑니다.
        </p>
        <p className="font-mono text-slate-500">
          객체 키 예: <code className="text-slate-400">home-hub/candidates/&lt;후보id&gt;.webp</code>
        </p>
        <p>
          예전에 <code className="text-slate-400">/images/home-hub/candidates/...</code>처럼{' '}
          <strong className="font-medium text-slate-400">로컬 public 경로</strong>가 JSON에 남아 있으면, 그 파일이 서버에 없을 때
          이미지가 깨집니다. 디스크가 빡빡하면 후보를 다시 생성해 Supabase URL로 바꾼 뒤 메인 적용하세요.
        </p>
        <p className="font-mono">
          국외연수 통역 2번째: 하이브리드 패널 <code className="text-slate-400">trainingPageSecondaryImage</code> · 우리여행 히어로:{' '}
          <code className="text-slate-400">private-trip-hero/</code>
        </p>
      </div>

      <HomeHubCardImagesWorkspace initialActive={initialActive} initialTravelPoolPreview={initialTravelPoolPreview} />

      <section className="mt-10 space-y-3 text-sm leading-relaxed text-slate-400">
        <p>
          문서: <code className="text-slate-300">docs/ADMIN-HOME-HUB-IMAGES-UI.md</code> ·{' '}
          <code className="text-slate-300">docs/HOME-HUB-CARD-IMAGES.md</code>
        </p>
      </section>
    </div>
  )
}
