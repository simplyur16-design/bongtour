import { EsimLandingWhySection } from '@/app/travel/esim/EsimLandingWhySection'

/** eSIM 랜딩 — 히어로 아래 본문·푸터 (초기 JS 분할용) */
export default function EsimLandingBelowFold() {
  return (
    <>
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-10 lg:max-w-5xl lg:px-0 lg:pb-14 lg:pt-12">
        <EsimLandingWhySection />

        <section className="mt-14 lg:mt-20" aria-labelledby="esim-reviews-heading">
          <h2
            id="esim-reviews-heading"
            className="text-center text-2xl font-bold tracking-tight text-slate-900 lg:text-3xl"
          >
            여행자들의 실제 후기
          </h2>
          <div className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 lg:mt-10">
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
