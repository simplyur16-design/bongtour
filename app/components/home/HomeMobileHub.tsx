import Link from 'next/link'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'
import HomeMobileHubSeasonBody from '@/app/components/home/HomeMobileHubSeasonBody'
import { MAIN_HOME_FIRST_HUB_DESCRIPTION, MAIN_HOME_FIRST_HUB_TITLE } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import PartnerOrganizationsSection from '@/app/components/home/PartnerOrganizationsSection'

const INQUIRY_TRAVEL = '/inquiry?type=travel'

const MAIN_TILES = [
  {
    href: '/travel/overseas',
    title: MAIN_HOME_FIRST_HUB_TITLE,
    desc: MAIN_HOME_FIRST_HUB_DESCRIPTION,
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

type Props = { seasonPick: HomeSeasonPickDTO }

/**
 * 모바일 전용(`lg` 미만) 메인 홈 — 상담 CTA / 시즌 추천(이미지·글) / 주요 서비스 / 실무 요청 / 파트너.
 */
export default function HomeMobileHub({ seasonPick }: Props) {
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
          내 여행 시작하기
        </Link>
      </div>

      <HomeMobileHubSeasonBody
        title={seasonPick.title}
        excerpt={seasonPick.excerpt}
        bodyFull={seasonPick.bodyFull}
        imageUrl={seasonPick.imageUrl}
        ctaHref={seasonPick.ctaHref}
        ctaLabel={seasonPick.ctaLabel}
      />

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
