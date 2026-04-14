import Link from 'next/link'
import Image from 'next/image'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import PartnerOrganizationsSection from '@/app/components/home/PartnerOrganizationsSection'

const INQUIRY_TRAVEL = '/inquiry?type=travel'

const MAIN_TILES = [
  {
    href: '/travel/overseas',
    title: '패키지',
    desc: '검증된 여행상품',
  },
  {
    href: '/travel/air-hotel',
    title: '항공+호텔',
    desc: '자유여행 · 에어텔',
  },
  {
    href: '/travel/overseas/private-trip',
    title: '우리여행',
    desc: '가족 · 소규모 맞춤여행',
  },
  {
    href: '/training',
    title: '국외연수',
    desc: '학교 · 기업 · 공공기관',
  },
] as const

const QUICK_ACTIONS = [
  { href: INQUIRY_TRAVEL, label: '상담접수' },
  { href: '/air-ticketing', label: '항공권' },
  { href: '/charter-bus', label: '전세버스' },
] as const

const TILE_CARD_CLASS =
  'flex min-h-[7.75rem] flex-col items-center justify-center rounded-2xl border border-bt-border-soft bg-white px-3 py-4 text-center shadow-sm ring-1 ring-bt-border-soft/40 transition active:scale-[0.99] hover:border-bt-border-strong hover:ring-bt-border-strong/30'

function SeasonCtaLink({ href, label }: { href: string; label: string }) {
  const cls =
    'mt-4 inline-flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800'
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={cls} rel="noopener noreferrer">
        {label}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  )
}

type Props = { seasonPick: HomeSeasonPickDTO }

/**
 * 모바일 전용(`md` 미만) 메인 홈 — 상담 CTA / 시즌 추천(이미지·글) / 주요 서비스 / 실무 요청 / 파트너.
 * 시즌 이미지는 관리자에서 Supabase 등 **절대 URL(https)** 로 저장하는 것을 권장(서버 `public`과 경로 불일치 방지).
 */
export default function HomeMobileHub({ seasonPick }: Props) {
  const img = seasonPick.imageUrl
  const isRemoteImg = Boolean(img && /^https?:\/\//i.test(img))
  /** `/images/...` 로컬 경로는 빌드·배포본 `public`에 파일이 있어야 함. https면 원격 그대로 표시. */
  const imageUnoptimized = isRemoteImg || Boolean(img?.startsWith('/'))

  return (
    <div className={`space-y-6 pb-8 pt-3 ${SITE_CONTENT_CLASS}`}>
      <div className="space-y-2">
        <p className="text-center text-[11px] font-semibold leading-snug tracking-tight text-teal-900 sm:text-xs">
          상담 시 여행자보험 무료
        </p>
        <Link
          href={INQUIRY_TRAVEL}
          className="flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-4 text-center text-base font-semibold text-white shadow-md transition hover:bg-teal-800"
        >
          내 여행 설계 시작하기
        </Link>
      </div>

      <section aria-label="시즌 추천" className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
        <h2 className="text-center text-xs font-semibold uppercase tracking-wide text-slate-500">시즌 추천</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80">
          <div className="relative aspect-[16/10] w-full bg-gradient-to-br from-teal-100/90 via-slate-100 to-slate-200/90">
            {img ? (
              <Image
                src={img}
                alt={seasonPick.title}
                fill
                className="object-cover"
                sizes="100vw"
                unoptimized={imageUnoptimized}
                priority={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-teal-600/25 via-slate-200/60 to-slate-300/50">
                <span className="text-sm font-semibold text-slate-700/90">Bong투어 시즌 픽</span>
              </div>
            )}
          </div>
          <div className="border-t border-slate-100 bg-white px-4 py-4">
            <h3 className="text-base font-bold leading-snug text-bt-title">{seasonPick.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{seasonPick.excerpt}</p>
            <SeasonCtaLink href={seasonPick.ctaHref} label={seasonPick.ctaLabel} />
          </div>
        </div>
      </section>

      <section aria-label="주요 서비스">
        <h2 className="mb-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">주요 서비스</h2>
        <ul className="grid grid-cols-2 gap-3" role="list">
          {MAIN_TILES.map((t) => (
            <li key={t.href} className="min-w-0">
              <Link href={t.href} className={TILE_CARD_CLASS}>
                <p className="text-[15px] font-bold leading-tight text-bt-title">{t.title}</p>
                <p className="mt-2 max-w-[11rem] text-[11px] leading-snug text-bt-muted">{t.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="실무 요청">
        <h2 className="mb-2.5 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">실무 요청</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="inline-flex min-h-[2.75rem] min-w-[5.5rem] flex-1 items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-3 text-center text-xs font-semibold text-slate-800 transition hover:border-teal-400 hover:bg-teal-50/70 sm:flex-none sm:px-4 sm:text-sm"
            >
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      <div className="border-t border-slate-200/80 pt-6">
        <PartnerOrganizationsSection />
      </div>
    </div>
  )
}
