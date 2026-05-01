import { Gift, MessageCircle, ShieldCheck, Signal } from 'lucide-react'
import { BONGSIM_KAKAO_CHANNEL_URL } from '@/lib/bongsim/constants'

const WHY_ITEMS = [
  {
    icon: MessageCircle,
    title: '24시간 안심 고객센터',
    body: '언제 어디서든 한국어로 빠른 응대 →',
    circleClass: 'bg-teal-100 text-teal-600',
    cardHref: BONGSIM_KAKAO_CHANNEL_URL,
  },
  {
    icon: ShieldCheck,
    title: '100% 환불보장',
    body: '제품 결함 시 전액 환불',
    circleClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Signal,
    title: '데이터 안정성',
    body: '현지 주요 통신사 직접 연결',
    circleClass: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Gift,
    title: '간편한 선물하기 기능',
    body: '친구·가족에게 쉽게 전송',
    circleClass: 'bg-amber-100 text-amber-600',
  },
] as const

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

          <div className="mx-auto mt-8 grid grid-cols-1 gap-4 text-left sm:mt-10 sm:grid-cols-2 lg:mt-12">
            {WHY_ITEMS.map((item) => {
              const { icon: Icon, title, body, circleClass } = item
              const cardClass =
                'flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md'
              const inner = (
                <>
                  <div
                    className={`flex shrink-0 items-center justify-center rounded-full p-3 ${circleClass}`}
                    aria-hidden
                  >
                    <Icon className="h-6 w-6" strokeWidth={2} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-900">{title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
                  </div>
                </>
              )
              const href = 'cardHref' in item ? item.cardHref : undefined
              if (href) {
                return (
                  <a
                    key={title}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${cardClass} text-inherit no-underline`}
                  >
                    {inner}
                  </a>
                )
              }
              return (
                <div key={title} className={cardClass}>
                  {inner}
                </div>
              )
            })}
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
