import Image from 'next/image'
import Link from 'next/link'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import HomeMobileHubSeasonCarousel from '@/app/components/home/HomeMobileHubSeasonCarousel'
import MobileHomeClientErrorBoundary from '@/app/components/home/MobileHomeClientErrorBoundary'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
import { MAIN_HOME_FIRST_HUB_DESCRIPTION, MAIN_HOME_FIRST_HUB_TITLE } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { resolveMobileMainTileBgSrc, type MobileMainTileBgKey } from '@/lib/home-mobile-hub-tile-images'
import PartnerOrganizationsSection from '@/app/components/home/PartnerOrganizationsSection'

const INQUIRY_TRAVEL = '/inquiry?type=travel'

/**
 * 카피·링크·하이브리드 매핑 키 — 실제 `bgSrc`는 `resolveMobileMainTileBgSrc`로 확정.
 * 배경 URL은 관리자 권장: 해외=유럽(영·프 등), 항공+호텔=이륙기, 우리여행=가족, 국외연수=회의장.
 */
const MAIN_TILES_SPEC = [
  {
    href: '/travel/overseas',
    title: MAIN_HOME_FIRST_HUB_TITLE,
    desc: MAIN_HOME_FIRST_HUB_DESCRIPTION,
    bgKey: 'overseas' as const satisfies MobileMainTileBgKey,
  },
  {
    href: '/travel/air-hotel',
    title: '항공+호텔',
    desc: '자유여행 · 에어텔',
    bgKey: 'airHotel' as const satisfies MobileMainTileBgKey,
  },
  {
    href: '/travel/overseas/private-trip',
    title: '우리여행',
    desc: '가족 · 소규모 맞춤여행',
    bgKey: 'privateTrip' as const satisfies MobileMainTileBgKey,
  },
  {
    href: '/training',
    title: '국외연수',
    desc: '학교 · 기업 · 공공기관',
    bgKey: 'training' as const satisfies MobileMainTileBgKey,
  },
] as const

const QUICK_ACTIONS = [
  { href: INQUIRY_TRAVEL, label: '상담접수', primary: true as const },
  { href: '/air-ticketing', label: '항공권', primary: false as const },
  { href: '/charter-bus', label: '전세버스', primary: false as const },
] as const

/**
 * 카드 외곽·높이·라운드 공통.
 * `isolate` + 음수 z-index 제거: 배경 레이어가 `bg-slate-100` 뒤로 깔려 이미지가 안 보이던 문제 방지.
 */
const TILE_CARD_CLASS =
  'relative flex min-h-[8.75rem] flex-col items-center justify-center overflow-hidden rounded-2xl border border-bt-border-soft bg-[#4a5d72] px-4 py-5 text-center shadow-sm ring-1 ring-bt-border-soft/40 transition active:scale-[0.99] hover:border-bt-border-strong hover:ring-bt-border-strong/30'

/** 배경 사진 또는 무이미지 시 대체 그라데이션 — 링크 배경 위 z-0 */
const TILE_BG_IMAGE_WRAP =
  'pointer-events-none absolute inset-0 z-0 block min-h-[8.75rem] w-full min-w-0'

/**
 * `mobileMainServiceTiles` URL 미설정 시 — 쿨그레이보다 살짝만 채도 있는 스틸블루(형광 없이 여행사 톤).
 * 실제 배경은 관리자에서 타일별 URL 지정 권장.
 */
const TILE_BG_FALLBACK_GRADIENT =
  'bg-gradient-to-br from-slate-600 via-blue-900 to-slate-800'

/** 사진 있을 때: 기존 하단 스크림 */
const TILE_BG_SCRIM =
  'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-black/35 to-black/78 max-lg:block lg:hidden'

/** 사진 없을 때: 스틸블루 베이스 위 가벼운 하단만 살짝 어둡게 */
const TILE_BG_SCRIM_FALLBACK =
  'pointer-events-none absolute inset-0 z-[1] bg-gradient-to-b from-transparent via-blue-950/28 to-slate-900/55 max-lg:block lg:hidden'

const TILE_BG_VIGNETTE =
  'pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-black/25 via-transparent to-black/15 max-lg:block lg:hidden'

const TILE_BG_VIGNETTE_FALLBACK =
  'pointer-events-none absolute inset-0 z-[2] bg-gradient-to-t from-slate-900/32 via-transparent to-slate-500/14 max-lg:block lg:hidden'

type Props = { seasonSlides: HomeSeasonPickDTO[] }

/**
 * 모바일 전용(`lg` 미만) 메인 홈 — 상담 CTA / 주요 서비스 / 시즌 추천(이미지·글) / 실무 요청 / 파트너.
 */
export default function HomeMobileHub({ seasonSlides }: Props) {
  const mainTiles = MAIN_TILES_SPEC.map((t) => ({
    ...t,
    bgSrc: resolveMobileMainTileBgSrc(t.bgKey),
  }))

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

      <section aria-label="주요 서비스">
        <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>주요 서비스</h2>
        <ul className="grid grid-cols-2 gap-3.5" role="list">
          {mainTiles.map((t, index) => (
            <li key={t.href} className="min-w-0">
              <Link href={t.href} className={TILE_CARD_CLASS}>
                {t.bgSrc ? (
                  <span className={TILE_BG_IMAGE_WRAP} aria-hidden>
                    <Image
                      src={t.bgSrc}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 48vw, 300px"
                      className="object-cover saturate-[0.92] contrast-[1.02]"
                      priority={index < 4}
                      unoptimized={/^https?:\/\//i.test(t.bgSrc)}
                    />
                  </span>
                ) : (
                  <span className={`${TILE_BG_IMAGE_WRAP} ${TILE_BG_FALLBACK_GRADIENT}`} aria-hidden />
                )}
                <span aria-hidden className={t.bgSrc ? TILE_BG_SCRIM : TILE_BG_SCRIM_FALLBACK} />
                <span aria-hidden className={t.bgSrc ? TILE_BG_VIGNETTE : TILE_BG_VIGNETTE_FALLBACK} />
                <span className="relative z-[3] flex flex-col items-center text-center">
                  <p className="text-lg font-extrabold leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] sm:text-xl">
                    {t.title}
                  </p>
                  <p className="mt-2.5 max-w-[13rem] text-sm font-semibold leading-snug text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.75)]">
                    {t.desc}
                  </p>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {seasonSlides.length > 0 ? (
        <MobileHomeClientErrorBoundary section="season-carousel">
          <HomeMobileHubSeasonCarousel slides={seasonSlides} hideManualNav />
        </MobileHomeClientErrorBoundary>
      ) : null}

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
