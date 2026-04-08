import Image from 'next/image'
import Link from 'next/link'
import { ClipboardList, Heart, MapPin, MessageCircle, Package, UserRound, Users } from 'lucide-react'
import PrivateGroupCustomerReviewSection from '@/app/components/travel/reviews/PrivateGroupCustomerReviewSection'
import type { PrivateTripHeroBriefingPayload } from '@/lib/overseas-editorial-prioritize'
import type { ReviewCardModel } from '@/lib/reviews-types'

const recommend = [
  {
    icon: Users,
    title: '가족여행으로 편하게 떠나고 싶은 분',
    body: '식사와 이동까지 가족의 리듬에 맞춰, 우리끼리 편하게 여행할 수 있도록 상담해드립니다.',
  },
  {
    icon: Heart,
    title: '친구·커플·소규모 모임으로 떠나고 싶은 분',
    body: '일행 분위기에 맞는 일정과 동선으로, 더 편안한 맞춤여행 방향을 안내해드립니다.',
  },
  {
    icon: Package,
    title: '기존 패키지를 우리끼리만 이용하고 싶은 분',
    body: '등록된 여행상품을 바탕으로 인원과 일정에 맞는 모임여행 형태로 진행 가능 여부를 상담해드립니다.',
  },
  {
    icon: ClipboardList,
    title: '모임 총무 부담을 줄이고 싶은 분',
    body: '견적과 일정 정리 부담을 덜어드리고, 동호회 여행이나 해외탐방 성격의 일정도 함께 검토해드립니다.',
  },
] as const

const benefits = [
  {
    title: '우리끼리 여행에 맞는 편안한 진행',
    body: '다른 팀 일정에 맞출 필요 없이, 우리 일행의 속도와 분위기에 맞춰 상담해드립니다.',
  },
  {
    title: '인원과 분위기에 맞춘 여행 구성',
    body: '가족여행, 동호회 여행, 소규모 단체여행처럼 구성에 맞는 흐름으로 방향을 잡아드립니다.',
  },
  {
    title: '검증된 여행상품을 바탕으로 한 상담',
    body: '등록된 여행상품을 기준으로 현실적으로 가능한 맞춤여행 방향을 제안해드립니다.',
  },
  {
    title: '준비 부담을 덜어주는 진행 방식',
    body: '총무 한 사람이 모든 걸 챙기지 않도록, 필요한 정보와 단계별 준비를 함께 정리해드립니다.',
  },
] as const

const steps = [
  { n: 1, title: '상담 문의', body: '희망 지역, 시기, 인원 구성을 알려주세요.' },
  { n: 2, title: '인원·일정·예산 확인', body: '꼭 맞춰야 할 조건을 함께 정리합니다.' },
  { n: 3, title: '맞춤 방향 제안', body: '가능한 상품과 동선을 기준으로 맞춤여행 방향을 안내해드립니다.' },
  { n: 4, title: '예약 진행', body: '상담 후 결정된 내용에 따라 순서대로 예약을 도와드립니다.' },
] as const

function SeasonBriefingHeroAside({
  briefing,
  inquiryHref,
}: {
  briefing: PrivateTripHeroBriefingPayload | null
  inquiryHref: string
}) {
  const thumbs = briefing?.supportingThumbs ?? []
  const hasHero = Boolean(briefing?.imageUrl)
  const ctaHref = briefing?.ctaHref || inquiryHref
  const ctaLabel = briefing?.ctaLabel || '예약·상담 문의하기'

  return (
    <aside className="mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border-2 border-teal-100 bg-white shadow-md ring-1 ring-slate-900/[0.04] lg:max-w-none">
      <div className="relative aspect-[5/4] w-full shrink-0 bg-slate-100 sm:aspect-[16/11] lg:aspect-[5/4] lg:min-h-[220px]">
        {hasHero ? (
          <Image
            src={briefing!.imageUrl!}
            alt={briefing!.imageAlt || briefing!.title}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width:1024px) 100vw, 480px"
            priority
          />
        ) : (
          <div className="absolute inset-0 flex flex-col">
            <div className="grid flex-1 grid-cols-3 gap-1 p-2">
              <div className="col-span-2 row-span-2 rounded-xl bg-slate-200/90 ring-1 ring-slate-300/40" />
              <div className="rounded-lg bg-slate-200/70 ring-1 ring-slate-300/30" />
              <div className="rounded-lg bg-slate-200/70 ring-1 ring-slate-300/30" />
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-full bg-white/90 p-4 shadow-sm ring-1 ring-slate-200">
                <MapPin className="h-10 w-10 text-teal-700" strokeWidth={1.5} aria-hidden />
              </div>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-slate-900/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
          운영 추천
        </div>
      </div>

      {thumbs.length > 0 ? (
        <div className="flex gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2.5">
          {thumbs.map((t) => (
            <div
              key={t.url}
              className="relative h-14 w-[28%] max-w-[120px] shrink-0 overflow-hidden rounded-lg bg-slate-200 ring-1 ring-slate-200/80 sm:h-16"
            >
              <Image src={t.url} alt={t.alt} fill unoptimized className="object-cover" sizes="120px" />
            </div>
          ))}
          {thumbs.length === 1 ? (
            <div className="relative h-14 min-w-0 flex-1 overflow-hidden rounded-lg border border-dashed border-slate-200 bg-white/80 sm:h-16" />
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-800">지금 예약하기 좋은 여행지</p>
        <h2 className="mt-2 text-xl font-bold leading-snug tracking-tight text-slate-900 sm:text-2xl">
          {briefing?.title ?? '맞춤 단독여행 · 상담으로 시작하기'}
        </h2>
        {briefing?.subtitle ? (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{briefing.subtitle}</p>
        ) : (
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            요즘 문의가 많은 일정과 준비하기 좋은 여행지를 안내합니다. 가까운 곳부터 장거리까지 일정만 알려 주셔도 방향을 함께 잡아 드립니다.
          </p>
        )}
        {briefing?.excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-700">{briefing.excerpt}</p>
        ) : null}
        {briefing && briefing.tags.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {briefing.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-teal-100 bg-teal-50/80 px-2.5 py-0.5 text-[11px] font-medium text-teal-900"
              >
                {t}
              </span>
            ))}
          </div>
        ) : null}
        {briefing?.sourceLine ? (
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{briefing.sourceLine}</p>
        ) : null}
        {/^https?:\/\//i.test(ctaHref) ? (
          <a
            href={ctaHref}
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 sm:w-auto sm:min-w-[220px]"
          >
            {ctaLabel}
          </a>
        ) : (
          <Link
            href={ctaHref}
            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800 sm:w-auto sm:min-w-[220px]"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </aside>
  )
}

type Props = {
  inquiryHref: string
  publishedReviews: ReviewCardModel[]
  publishedTotalCount: number
  heroBriefing?: PrivateTripHeroBriefingPayload | null
}

export default function PrivateTripLanding({
  inquiryHref,
  publishedReviews,
  publishedTotalCount,
  heroBriefing = null,
}: Props) {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
          <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14 lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-800/80">맞춤 상담 · 소규모 그룹</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.35rem] lg:leading-tight">
                단독여행
              </h1>
              <p className="mt-5 text-base leading-relaxed text-slate-700 sm:text-lg">
                등록된 여행상품 외에도, 인원과 일정에 맞춰{' '}
                <span className="font-medium text-slate-800">우리 일행만의 여행</span>으로 상담해드립니다.
              </p>
              <p className="mt-3 text-base leading-relaxed text-slate-700 sm:text-lg">
                가족여행, 동호회 여행, 소규모 모임까지 원하는 흐름에 맞춰 방향을 함께 잡아드립니다.
              </p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                모임 총무가 하나하나 신경 쓰지 않도록, 검증된 여행상품을 바탕으로 일정과 견적 정리를 함께 도와드립니다.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link
                  href={inquiryHref}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-75 hover:bg-teal-800"
                >
                  단독견적 문의하기
                </Link>
                <Link
                  href={`${inquiryHref}${inquiryHref.includes('?') ? '&' : '?'}topic=custom`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-75 hover:border-teal-300 hover:bg-teal-50/60 hover:text-teal-900"
                >
                  맞춤여행 상담 받기
                </Link>
              </div>
            </div>
            <SeasonBriefingHeroAside briefing={heroBriefing} inquiryHref={inquiryHref} />
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">이런 분들께 추천합니다</h2>
          <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-[15px]">
            가족여행·모임여행·소규모 단체여행까지, 스타일만 알려 주시면 방향을 함께 맞춥니다.
          </p>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {recommend.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className="rounded-2xl border border-slate-100 bg-slate-50/50 p-6 transition-[border-color,background-color] duration-75 hover:border-teal-200/80 hover:bg-teal-50/30"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700/10 text-teal-800">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold leading-snug text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
                </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-slate-100 bg-slate-50/70 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">우리 일행만의 여행이 좋은 이유</h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:gap-10">
            {benefits.map((b, i) => (
              <div key={b.title} className="flex gap-4 border-l-4 border-teal-600 pl-5 sm:pl-6">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{b.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{b.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">상담은 이렇게 진행됩니다</h2>
          <div className="relative mt-14">
            <div
              className="pointer-events-none absolute left-[8%] right-[8%] top-7 hidden h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent lg:block"
              aria-hidden
            />
            <ol className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {steps.map((s) => (
                <li key={s.n} className="flex flex-col items-start">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-teal-600 bg-white text-lg font-bold text-teal-800 shadow-sm">
                    {s.n}
                  </span>
                  <h3 className="mt-5 text-base font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <PrivateGroupCustomerReviewSection
        publishedReviews={publishedReviews}
        publishedTotalCount={publishedTotalCount}
        inquiryHref={inquiryHref}
        headingOverride="단독여행 후기"
        descriptionOverride="가족여행, 모임여행, 소규모 단체여행으로 먼저 다녀오신 분들의 이야기를 통해 분위기와 진행 방식을 확인해보세요."
        hideFooterCta
        hideEyebrow
      />

      <section className="border-t border-slate-200 bg-gradient-to-b from-slate-900 to-slate-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <UserRound className="mx-auto h-10 w-10 text-teal-300/90" strokeWidth={1.25} aria-hidden />
          <h2 className="mt-6 text-xl font-semibold leading-snug sm:text-2xl">
            우리끼리 편하게 떠날 수 있는지, 단독견적과 일정 방향부터 상담으로 확인해보세요.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">어떤 방식이 잘 맞는지 함께 안내해드립니다.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={inquiryHref}
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl bg-teal-500 px-8 py-3 text-sm font-semibold text-white transition-colors duration-75 hover:bg-teal-400"
            >
              단독견적 문의하기
            </Link>
            <Link
              href={`${inquiryHref}${inquiryHref.includes('?') ? '&' : '?'}topic=custom`}
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl border border-white/25 bg-white/10 px-8 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-75 hover:border-teal-300/50 hover:bg-teal-500/20"
            >
              맞춤여행 상담 받기
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
