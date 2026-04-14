import Link from 'next/link'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
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
  { href: INQUIRY_TRAVEL, label: '상담접수', primary: true as const },
  { href: '/air-ticketing', label: '항공권', primary: false as const },
  { href: '/charter-bus', label: '전세버스', primary: false as const },
] as const

const TILE_CARD_CLASS =
  'flex min-h-[8.75rem] flex-col items-center justify-center rounded-2xl border border-bt-border-soft bg-white px-4 py-5 text-center shadow-sm ring-1 ring-bt-border-soft/40 transition active:scale-[0.99] hover:border-bt-border-strong hover:ring-bt-border-strong/30'

type Props = { seasonSlides: HomeSeasonPickDTO[] }

/**
 * 모바일 전용(`lg` 미만) 메인 홈 — 상담 CTA / 시즌 추천(이미지·글) / 주요 서비스 / 실무 요청 / 파트너.
 */
export default function HomeMobileHub({ seasonSlides }: Props) {
  return (
    <div className={`space-y-7 pb-8 pt-3 ${SITE_CONTENT_CLASS}`}>
      <div className="space-y-2">
        <p className="text-center text-[11px] font-semibold leading-snug tracking-tight text-teal-900 sm:text-xs">
          상담 완료시 여행자보험 무료
        </p>
        <Link
          href={INQUIRY_TRAVEL}
          className="flex w-full items-center justify-center rounded-xl bg-teal-700 px-4 py-4 text-center text-base font-semibold text-white shadow-md transition hover:bg-teal-800"
        >
          내 여행 시작하기
        </Link>
      </div>

      <HomeMobileHubSeasonCarousel slides={seasonSlides} />

      <section aria-label="주요 서비스">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>주요 서비스</h2>
        <ul className="grid grid-cols-2 gap-3.5" role="list">
          {MAIN_TILES.map((t) => (
            <li key={t.href} className="min-w-0">
              <Link href={t.href} className={TILE_CARD_CLASS}>
                <p className="text-lg font-bold leading-tight text-bt-title sm:text-xl">{t.title}</p>
                <p className="mt-2.5 max-w-[13rem] text-sm font-medium leading-snug text-bt-muted">{t.desc}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="실무 요청">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>실무 요청</h2>
        <div className="flex w-full flex-col gap-3.5 sm:flex-row sm:flex-wrap sm:justify-center">
          {QUICK_ACTIONS.map((a) =>
            a.primary ? (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex w-full min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl bg-teal-700 px-5 py-3.5 text-center text-base font-bold text-white shadow-md ring-2 ring-teal-800/25 transition hover:bg-teal-800 active:scale-[0.99] sm:w-auto sm:min-w-[10.5rem]"
              >
                {a.label}
              </Link>
            ) : (
              <Link
                key={a.href}
                href={a.href}
                className="inline-flex w-full min-h-[3.25rem] shrink-0 items-center justify-center rounded-xl border-2 border-slate-400/90 bg-slate-50 px-5 py-3.5 text-center text-base font-bold text-slate-900 shadow-sm transition hover:border-teal-600 hover:bg-teal-50/90 active:scale-[0.99] sm:w-auto sm:min-w-[9.5rem]"
              >
                {a.label}
              </Link>
            )
          )}
        </div>
      </section>

      <div className="border-t border-slate-200/80 pt-7">
        <PartnerOrganizationsSection />
      </div>
    </div>
  )
}
