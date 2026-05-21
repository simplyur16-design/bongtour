import Link from 'next/link'
import { UserRound } from 'lucide-react'
import GroupMeetingReviewsSection from '@/app/components/travel/reviews/GroupMeetingReviewsSection'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

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

type Props = {
  privateQuoteHref: string
  travelConsultHref: string
  groupMeetingReviews: GroupMeetingReviewCardModel[]
}

export default function PrivateTripLanding({
  privateQuoteHref,
  travelConsultHref,
  groupMeetingReviews,
}: Props) {
  return (
    <>
      <section className="border-b border-slate-100 bg-slate-50/70 py-16 sm:py-20">
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

      <GroupMeetingReviewsSection reviews={groupMeetingReviews} />

      <section className="border-t border-teal-100 bg-gradient-to-b from-teal-50 to-cyan-50 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <UserRound className="mx-auto h-10 w-10 text-teal-700" strokeWidth={1.25} aria-hidden />
          <h2 className="mt-6 text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            우리끼리 편하게 떠날 수 있는지, 우리견적과 일정 방향부터 상담으로 확인해보세요.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">어떤 방식이 잘 맞는지 함께 안내해드립니다.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={privateQuoteHref}
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl bg-teal-600 px-8 py-3 text-sm font-semibold text-white transition-colors duration-75 hover:bg-teal-700"
            >
              우리견적 문의하기
            </Link>
            <Link
              href={`${travelConsultHref}${travelConsultHref.includes('?') ? '&' : '?'}topic=custom`}
              className="inline-flex min-h-[48px] min-w-[200px] items-center justify-center rounded-xl border border-slate-300 bg-white px-8 py-3 text-sm font-semibold text-slate-900 transition-colors duration-75 hover:bg-slate-50"
            >
              맞춤여행 상담 받기
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
