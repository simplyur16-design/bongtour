import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { homeHubCardImageSrc } from '@/lib/home-hub-images'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/**
 * 우리끼리 + 공공·기업 안내 카드 (메인 PC 하단 진입).
 */
export default function ServiceInfoCards() {
  const privateImg = homeHubCardImageSrc('overseas', 'webp')
  const trainingImg = homeHubCardImageSrc('training', 'webp')

  return (
    <section
      aria-labelledby="service-info-cards-heading"
      className="border-b border-bt-border-soft/60 bg-white py-10 sm:py-12"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <h2 id="service-info-cards-heading" className="sr-only">
          맞춤·기관 서비스
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          <Link
            href="/travel/overseas?scope=private-trip"
            className="group relative flex min-h-[14rem] flex-col overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-md transition hover:ring-2 hover:ring-bt-text-navy/15"
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 z-0 [filter:brightness(0.92)_saturate(1.08)] transition group-hover:[filter:brightness(1.0)_saturate(1.15)]">
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
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/90 drop-shadow">
                가족·지인과 함께하는 단독 일정으로 동선과 속도를 맞춰 제안합니다.
              </p>
              <span className="mt-4 inline-flex rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-bt-text-navy shadow">
                우리끼리 살펴보기
              </span>
            </div>
          </Link>

          <Link
            href="/business"
            className="group relative flex min-h-[14rem] flex-col overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-md transition hover:ring-2 hover:ring-bt-text-navy/15"
          >
            <div className="absolute inset-0 z-0">
              <div className="absolute inset-0 z-0 [filter:brightness(0.92)_saturate(1.08)] transition group-hover:[filter:brightness(1.0)_saturate(1.15)]">
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
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-white/90 drop-shadow">
                정부·공공·기업 목적에 맞춰 기관 섭외와 통역, 이동 운영까지 설계합니다.
              </p>
              <span className="mt-4 inline-flex rounded-full bg-white/95 px-4 py-2 text-sm font-bold text-bt-text-navy shadow">
                공공·기업 보기
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}
