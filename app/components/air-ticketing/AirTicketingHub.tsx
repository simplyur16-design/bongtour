import Link from 'next/link'
import Header from '@/app/components/Header'
import {
  AIR_TICKETING_HERO,
  airTicketingClosing,
  airTicketingFaqItems,
  airTicketingPaymentBlocks,
  airTicketingProcessIntro,
  airTicketingProcessPoints,
  airTicketingUseCases,
} from '@/lib/air-ticketing-content'

export default function AirTicketingHub() {
  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        <section className="border-b border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Air ticketing</p>
            <h1 className="bt-wrap mt-2 text-[clamp(1.35rem,4vw,2.25rem)] font-semibold leading-[1.35] tracking-tight text-slate-900 sm:text-4xl">
              {AIR_TICKETING_HERO.title}
            </h1>
            <p className="bt-wrap mt-3 text-lg font-semibold text-slate-800 sm:text-xl">{AIR_TICKETING_HERO.sub}</p>
            <div className="mx-auto mt-5 max-w-2xl space-y-3 text-center text-[17px] leading-[1.75] text-slate-700">
              {AIR_TICKETING_HERO.bodyParagraphs.map((para, idx) => (
                <p key={idx} className="bt-wrap [text-wrap:pretty]">
                  {para}
                </p>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#air-faq"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold !text-slate-900 shadow-sm hover:bg-slate-50 sm:text-base"
              >
                FAQ 확인하기
              </a>
              <Link
                href="/inquiry?type=travel&source=/air-ticketing"
                className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-[15px] font-semibold text-white hover:bg-slate-800 sm:text-base"
              >
                항공권 상담 요청하기
              </Link>
            </div>
          </div>
        </section>

        <section id="air-cases" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              이런 경우에 항공권 예매 및 발권 안내를 이용하실 수 있습니다
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {airTicketingUseCases.map((c) => (
                <article key={c.id} className="rounded-xl border border-bt-border bg-white p-5 text-center shadow-sm">
                  <h3 className="text-center text-lg font-semibold text-slate-900">{c.title}</h3>
                  <p className="bt-wrap mt-3 text-center text-[15px] leading-[1.65] text-slate-700">{c.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="air-process" className="scroll-mt-24 border-y border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {airTicketingProcessIntro.sectionTitle}
            </h2>
            <p className="bt-wrap mx-auto mt-4 max-w-3xl text-center text-[17px] leading-[1.7] text-slate-700">
              {airTicketingProcessIntro.lead}
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {airTicketingProcessPoints.map((p) => (
                <article key={p.id} className="rounded-xl border border-bt-border bg-white p-5 text-left shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-900">{p.title}</h3>
                  <p className="bt-wrap mt-2 text-[15px] leading-[1.65] text-slate-700">{p.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="air-payment" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                증빙 및 결제 안내
              </h2>
              <p className="mt-3 text-[15px] leading-[1.75] text-slate-600 [word-break:keep-all] [text-wrap:pretty]">
                여행상품 포함 항공권과 항공권 단독 결제는 현금영수증 기준이 다릅니다. 법인카드 결제는 별도 블록에서
                확인해 주세요.
              </p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {airTicketingPaymentBlocks.map((b) => (
                <article
                  key={b.id}
                  className={`rounded-xl border bg-white p-5 text-center shadow-sm ${
                    b.id === 'corp' ? 'border-2 border-slate-200 bg-slate-50/80' : 'border-bt-border'
                  }`}
                >
                  <h3 className="text-lg font-semibold text-slate-900 [word-break:keep-all] [text-wrap:pretty]">
                    {b.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-[1.75] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
                    {b.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="air-faq" className="scroll-mt-24 border-y border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              자주 묻는 질문
            </h2>
            <div className="mt-8 space-y-2">
              {airTicketingFaqItems.map((item) => (
                <details
                  key={item.id}
                  className="group rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm open:border-bt-accent/40 open:shadow-md"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 text-left text-[15px] leading-relaxed text-slate-900 [word-break:keep-all] [text-wrap:pretty] sm:text-base">
                        {item.question}
                      </span>
                      <span
                        className="mt-0.5 shrink-0 text-slate-500 transition group-open:rotate-180"
                        aria-hidden
                      >
                        ▼
                      </span>
                    </span>
                  </summary>
                  <p className="faq-answer mt-3 border-t border-slate-100 pt-3 text-left text-[15px] leading-[1.65] text-slate-700 [word-break:keep-all]">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section id="air-consult" className="scroll-mt-24 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-14">
          <div className="mx-auto max-w-3xl rounded-xl border border-sky-200 bg-sky-50/60 p-6 text-center sm:p-8">
            <h2 className="text-xl font-semibold leading-snug text-slate-900 sm:text-2xl [text-wrap:pretty] [word-break:keep-all]">
              {airTicketingClosing.title}
            </h2>
            <div className="mx-auto mt-5 max-w-2xl space-y-3 text-[17px] leading-[1.75] text-slate-700 [word-break:keep-all]">
              {airTicketingClosing.bodyParagraphs.map((para, idx) => (
                <p key={idx} className="[text-wrap:pretty]">
                  {para}
                </p>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-4">
              <a
                href="#air-faq"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-[15px] font-semibold !text-slate-900 shadow-sm transition hover:bg-slate-50 sm:min-h-0 sm:text-base"
              >
                FAQ 확인하기
              </a>
              <Link
                href="/inquiry?type=travel&source=/air-ticketing"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-slate-900 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-slate-800 sm:min-h-0 sm:text-base"
              >
                항공권 상담 요청하기
              </Link>
            </div>
            <p className="mx-auto mt-6 max-w-xl text-[14px] leading-relaxed text-slate-600 [word-break:keep-all] [text-wrap:pretty]">
              {airTicketingClosing.supportHintBefore}
              <Link href="/support" className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline">
                고객지원
              </Link>
              {airTicketingClosing.supportHintAfter}
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}
