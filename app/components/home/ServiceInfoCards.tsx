import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { homeHubCardImageSrc } from '@/lib/home-hub-images'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 목업·SSOT 전용 — 라이브 hub JSON / overseas 폴더와 분리 */
const PRIVATE_TRIP_ENTRY_IMG =
  'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=1200'

/**
 * 우리끼리 + 공공·기업 안내 카드 (메인 PC 하단 진입).
 * REGRESSION-FREEZE[home-private-trip-href]: /travel/overseas/private-trip — manifest
 */
export default function ServiceInfoCards({ oceanWarm = false }: { oceanWarm?: boolean }) {
  const privateImg = oceanWarm ? PRIVATE_TRIP_ENTRY_IMG : homeHubCardImageSrc('overseas', 'webp')
  const trainingImg = homeHubCardImageSrc('training', 'webp')

  const privateBody = oceanWarm
    ? '다른 팀 일정에 맞출 필요 없이, 우리 일행의 속도와 분위기에 맞춰 상담합니다.'
    : '가족·지인과 함께하는 단독 일정으로 동선과 속도를 맞춰 제안합니다.'

  const orgBody = oceanWarm
    ? '정부·공공·기업 목적의 연수·전세버스·발권·통역은 상담 후 안내합니다.'
    : '정부·공공·기업 목적에 맞춰 기관 섭외와 통역, 이동 운영까지 설계합니다.'

  const privateCta = oceanWarm ? '문의하기' : '우리끼리 살펴보기'
  const orgCta = oceanWarm ? '견적의뢰하기' : '공공·기업 보기'

  return (
    <section
      aria-labelledby="service-info-cards-heading"
      className={
        oceanWarm
          ? 'ow-live-service border-b py-10 sm:py-12'
          : 'border-b border-bt-border-soft/60 bg-white py-10 sm:py-12'
      }
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        {/* REGRESSION-FREEZE[home-hero-lcp-and-section-titles]: 맞춤·기관 가시 제목 — manifest */}
        <h2
          id="service-info-cards-heading"
          className={
            oceanWarm
              ? 'ow-live-section-title mb-6 text-center text-xl tracking-tight sm:text-2xl'
              : 'mb-6 text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl'
          }
        >
          {oceanWarm ? '우리끼리 · 단체·기관' : '맞춤·기관 서비스'}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <Link
            href="/travel/overseas/private-trip"
            className="group relative flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-md transition hover:ring-2 hover:ring-bt-text-navy/15 sm:min-h-[18rem]"
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 z-0 [filter:brightness(0.98)_saturate(1.04)] transition group-hover:[filter:brightness(1.0)_saturate(1.08)]">
                <SafeImage
                  src={privateImg}
                  alt=""
                  fill
                  className="object-cover object-center"
                  sizes="(max-width:768px) 100vw, 50vw"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-3/5 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
                aria-hidden
              />
            </div>
            <div className="relative z-[2] mt-auto p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/90">우리끼리</p>
              <p className="mt-1 text-xl font-bold text-white drop-shadow sm:text-2xl">가족·소그룹 단독 진행</p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/90 drop-shadow">{privateBody}</p>
              <span
                className={
                  oceanWarm
                    ? 'ow-live-cta-warm mt-4 inline-flex rounded-[10px] px-4 py-2 text-sm font-bold shadow'
                    : 'mt-4 inline-flex rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-bt-text-navy shadow'
                }
              >
                {privateCta}
              </span>
            </div>
          </Link>

          <Link
            href="/business"
            className="group relative flex min-h-[16rem] flex-col overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-md transition hover:ring-2 hover:ring-bt-text-navy/15 sm:min-h-[18rem]"
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 z-0 [filter:brightness(0.98)_saturate(1.04)] transition group-hover:[filter:brightness(1.0)_saturate(1.08)]">
                <SafeImage
                  src={trainingImg}
                  alt=""
                  fill
                  className="object-cover object-[center_38%]"
                  sizes="(max-width:768px) 100vw, 50vw"
                />
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-3/5 bg-gradient-to-t from-black/65 via-black/15 to-transparent"
                aria-hidden
              />
            </div>
            <div className="relative z-[2] mt-auto p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/90">공공·기업</p>
              <p className="mt-1 text-xl font-bold text-white drop-shadow sm:text-2xl">연수·전세버스·발권</p>
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/90 drop-shadow">{orgBody}</p>
              <span
                className={
                  oceanWarm
                    ? 'ow-live-cta-warm mt-4 inline-flex rounded-[10px] px-4 py-2 text-sm font-bold shadow'
                    : 'mt-4 inline-flex rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-bt-text-navy shadow'
                }
              >
                {orgCta}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}
