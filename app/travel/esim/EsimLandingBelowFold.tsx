import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { BarChart3, Map, MessageCircle, ShieldCheck, Sparkles, Zap } from 'lucide-react'
import { BONGSIM_KAKAO_CHANNEL_URL, bongsimPath } from '@/lib/bongsim/constants'

type WhyItem = {
  icon: LucideIcon
  title: string
  body: string
  hint?: string
  circleClass: string
  href?: string
  linkLabel?: string
  external?: boolean
}

const WHY_ITEMS: readonly WhyItem[] = [
  {
    icon: Zap,
    title: '원클릭 설치',
    body: 'QR 코드와 설치 문자 한 번 클릭이면 끝',
    hint: 'iOS 17.4+ / Android 13+ 필요',
    href: bongsimPath('/guide'),
    linkLabel: '자세히 보기 →',
    circleClass: 'bg-pink-100 text-pink-600',
  },
  {
    icon: ShieldCheck,
    title: '품질보장서비스',
    body: '제품 결함 시 전액 환불',
    circleClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: BarChart3,
    title: '데이터 사용량 실시간 확인',
    body: '마이페이지에서 남은 데이터를 언제든 확인',
    href: '/mypage/esim',
    linkLabel: '사용량 확인하기 →',
    circleClass: 'bg-sky-100 text-sky-600',
  },
  {
    icon: Map,
    title: '구글맵 데이터 무료',
    body: '해외에서 구글지도 길찾기를 데이터 차감 없이',
    href: bongsimPath('/benefits/google-maps'),
    linkLabel: '자세히 보기 →',
    circleClass: 'bg-teal-100 text-teal-600',
  },
  {
    icon: Sparkles,
    title: 'ChatGPT 데이터 무료',
    body: '여행 중 번역·검색을 데이터 부담 없이',
    href: bongsimPath('/benefits/chatgpt'),
    linkLabel: '자세히 보기 →',
    circleClass: 'bg-violet-100 text-violet-600',
  },
  {
    icon: MessageCircle,
    title: '안심 고객센터',
    body: 'Bong투어 카카오톡으로 문의하세요 (09:00-18:00 KST)',
    href: BONGSIM_KAKAO_CHANNEL_URL.trim() || undefined,
    linkLabel: '카카오톡 문의하기',
    external: true,
    circleClass: 'bg-amber-100 text-amber-600',
  },
]

function WhyCard({ item }: { item: WhyItem }) {
  const { icon: Icon, title, body, hint, circleClass, href, linkLabel, external } = item
  const cardClass =
    'flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:border-teal-200 hover:shadow-md'

  const inner = (
    <>
      <div
        className={`flex shrink-0 items-center justify-center rounded-full p-3 ${circleClass}`}
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={2} />
      </div>
      <div className="w-full min-w-0">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-700">{body}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
        {href && linkLabel ? (
          <span className="mt-2 inline-block text-sm font-medium text-teal-600 underline-offset-4 group-hover:underline">
            {linkLabel}
          </span>
        ) : null}
      </div>
    </>
  )

  if (!href) {
    return <div className={cardClass}>{inner}</div>
  }

  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group ${cardClass}`}
      >
        {inner}
      </a>
    )
  }

  return (
    <Link href={href} className={`group ${cardClass}`}>
      {inner}
    </Link>
  )
}

/** eSIM 랜딩 — 히어로 아래 본문·푸터 (초기 JS 분할용) */
export default function EsimLandingBelowFold() {
  return (
    <>
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-10 lg:max-w-5xl lg:px-0 lg:pb-14 lg:pt-12">
        <section className="text-center" aria-labelledby="esim-why-heading">
          <h2 id="esim-why-heading" className="text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl">
            왜 Bong투어 <span className="text-orange-600">eSIM</span>일까요?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base leading-relaxed text-slate-600 lg:mt-4 lg:text-lg">
            여행 준비부터 현지 체류까지, 데이터 걱정을 덜어 드립니다.
          </p>

          <div className="mx-auto mt-8 grid grid-cols-1 gap-4 sm:mt-10 md:grid-cols-3 lg:mt-12">
            {WHY_ITEMS.map((item) => (
              <WhyCard key={item.title} item={item} />
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <Link
              href={bongsimPath('/devices')}
              className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
            >
              사용가능 기기 확인하기 →
            </Link>
            <Link
              href={bongsimPath('/guide')}
              className="text-sm font-medium text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-teal-800 hover:decoration-teal-400"
            >
              eSIM 설치 가이드 보기 →
            </Link>
          </div>
        </section>

        <section className="mt-14 lg:mt-20" aria-labelledby="esim-reviews-heading">
          <h2
            id="esim-reviews-heading"
            className="text-center text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl"
          >
            여행자들의 실제 후기
          </h2>
          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3 lg:mt-10">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-amber-400" aria-hidden>
                ★★★★★
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                일본 여행에서 완전 무제한으로 썼는데 구글맵이랑 번역기 걱정 없이 잘 썼어요!
              </p>
              <p className="mt-4 text-sm text-slate-500">김지* · 일본 5일</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-amber-400" aria-hidden>
                ★★★★★
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                태국에서 무제한 eSIM 쓰니까 그랩 호출이랑 맛집 검색이 자유로웠어요. 가격도 착해요.
              </p>
              <p className="mt-4 text-sm text-slate-500">박민* · 태국 7일</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-amber-400" aria-hidden>
                ★★★★★
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                설치가 진짜 1분이면 끝나요. QR코드 스캔만 하면 되니까 공항에서 유심 안 사도 돼요.
              </p>
              <p className="mt-4 text-sm text-slate-500">이수* · 베트남 4일</p>
            </article>
          </div>
        </section>
      </main>

      <footer className="w-full bg-slate-50 py-6 text-center">
        <div className="mx-auto max-w-4xl px-4 lg:max-w-5xl lg:px-0">
          <p className="text-sm leading-relaxed text-slate-600">
            <span className="font-semibold text-slate-800">간편이심</span>은 Bong투어가 직접 운영하고 판매하는 서비스입니다.
          </p>
        </div>
      </footer>
    </>
  )
}
