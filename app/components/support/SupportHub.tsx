import Link from 'next/link'
import Header from '@/app/components/Header'
import {
  SUPPORT_HERO,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
  supportCategories,
  supportContactCopy,
  supportFaqItems,
  supportOpenKakaoNotice,
  supportProcessNote,
  supportProcessSteps,
  supportReceiptInfo,
  supportReceiptSummaryLines,
} from '@/lib/support-content'

export default function SupportHub() {
  const phoneParts = supportContactCopy.phoneLine.split(SUPPORT_PHONE_DISPLAY)

  return (
    <div className="min-h-screen bg-bt-page">
      <Header />
      <main>
        {/* A. Hero */}
        <section className="border-b border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-16">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">고객지원</p>
            <h1 className="bt-wrap mt-2 text-[clamp(1.5rem,4.5vw,2.25rem)] font-semibold leading-[1.35] tracking-tight text-slate-900 sm:text-4xl">
              {SUPPORT_HERO.title}
            </h1>
            <div className="mx-auto mt-4 max-w-2xl space-y-2 text-center text-[17px] leading-[1.75] text-slate-700 [word-break:keep-all]">
              {SUPPORT_HERO.bodyLines.map((line, idx) => (
                <p key={idx} className="bt-wrap [text-wrap:pretty]">
                  {line}
                </p>
              ))}
            </div>
          </div>
        </section>

        {/* B. 빠른 도움 카테고리 */}
        <section id="support-categories" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">빠른 도움</h2>
            <p className="bt-wrap mx-auto mt-2 max-w-2xl text-center text-[15px] text-slate-600">
              필요한 항목으로 이동해 안내를 확인하실 수 있습니다.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {supportCategories.map((c) => (
                <Link
                  key={c.id}
                  href={`#${c.anchor}`}
                  className="group flex flex-col items-center rounded-xl border border-bt-border bg-white p-5 text-center shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <h3 className="text-lg font-semibold text-slate-900 group-hover:text-bt-accent">{c.title}</h3>
                  <p className="mt-3 max-w-[28ch] text-[15px] leading-[1.65] text-slate-700 [word-break:keep-all] [text-wrap:pretty] sm:max-w-none">
                    {c.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* C. FAQ */}
        <section id="support-faq" className="scroll-mt-24 border-y border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">자주 묻는 질문</h2>
            <div className="mt-8 space-y-2">
              {supportFaqItems.map((item) => (
                <details
                  key={item.id}
                  className="group rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm open:border-bt-accent/40 open:shadow-md"
                >
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1 text-left text-[15px] leading-relaxed text-slate-900 [word-break:keep-all] [text-wrap:pretty] sm:text-base">
                        {item.question}
                      </span>
                      <span className="mt-0.5 shrink-0 text-slate-500 transition group-open:rotate-180" aria-hidden>
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

        {/* D. 진행 안내 */}
        <section id="support-process" className="scroll-mt-24 px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">진행 안내</h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[17px] leading-[1.75] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
              문의 내용과 서비스 유형에 따라 확인 범위는 달라질 수 있지만, 기본적으로 아래 흐름으로 진행됩니다.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {supportProcessSteps.map((s) => (
                <article
                  key={s.step}
                  className="flex flex-col items-center rounded-xl border border-bt-border bg-white p-4 text-center shadow-sm"
                >
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                    {s.step}
                  </span>
                  <h3 className="mt-3 text-center text-base font-semibold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-center text-[15px] leading-[1.7] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
                    {s.description}
                  </p>
                </article>
              ))}
            </div>
            <p className="mx-auto mt-8 max-w-2xl rounded-lg border border-sky-200 bg-sky-50/70 px-5 py-4 text-center text-[15px] leading-[1.75] text-slate-800 [word-break:keep-all] [text-wrap:pretty] sm:px-6 sm:text-base">
              {supportProcessNote}
            </p>
          </div>
        </section>

        {/* E. 연락 채널 */}
        <section id="support-contact" className="scroll-mt-24 border-y border-bt-border bg-bt-surface px-4 py-12 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {supportContactCopy.sectionTitle}
            </h2>
            <p className="mt-4 text-center text-[17px] leading-[1.75] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
              {supportContactCopy.lead}
            </p>
            <div className="mt-6 space-y-4 rounded-xl border border-bt-border bg-white p-5 text-center shadow-sm sm:text-left">
              <p className="text-[17px] leading-[1.75] text-slate-800">
                {phoneParts[0]}
                <a
                  href={SUPPORT_PHONE_TEL}
                  className="font-semibold text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
                >
                  {SUPPORT_PHONE_DISPLAY}
                </a>
                {phoneParts[1]}
              </p>
              <p className="text-[15px] leading-[1.65] text-slate-700 [word-break:keep-all]">{supportContactCopy.kakaoLine}</p>
              <p className="text-[15px] leading-[1.65] text-slate-700 [word-break:keep-all]">{supportContactCopy.missedCallLine}</p>
            </div>
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-5 text-left shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">{supportOpenKakaoNotice.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{supportOpenKakaoNotice.greeting}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{supportOpenKakaoNotice.hours}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{supportOpenKakaoNotice.quickGuide}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{supportOpenKakaoNotice.emergency}</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{supportOpenKakaoNotice.caution}</p>
            </div>
          </div>
        </section>

        {/* F. 증빙/영수증 */}
        <section id="support-receipt" className="scroll-mt-24 px-4 pb-16 pt-12 sm:px-6 sm:pb-20 sm:pt-14">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              증빙 및 영수증 안내
            </h2>
            <div className="mx-auto mt-3 max-w-2xl space-y-2 text-center text-[17px] leading-[1.75] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
              <p>서비스와 결제·발급 주체에 따라 안내가 달라질 수 있습니다.</p>
              <p>아래를 참고하시고, 세부 사항은 진행 시 담당자 안내를 따르시면 됩니다.</p>
            </div>
            <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-slate-200 bg-white px-4 py-6 text-center shadow-sm sm:px-8 sm:py-7">
              <p className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">요약</p>
              <ul className="mx-auto mt-4 max-w-2xl space-y-3 text-[15px] leading-[1.7] text-slate-700">
                {supportReceiptSummaryLines.map((line) => (
                  <li key={line} className="list-none [word-break:keep-all] [text-wrap:pretty]">
                    {line}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {supportReceiptInfo.map((block) => (
                <article
                  key={block.id}
                  className="flex flex-col rounded-xl border border-bt-border bg-white p-5 text-center shadow-sm"
                >
                  <h3 className="text-lg font-semibold leading-snug text-slate-900">{block.title}</h3>
                  {block.id === 'receipt-air-hub' ? (
                    <p className="mt-4 text-[15px] leading-[1.7] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
                      여행상품 포함 항공권, 단독 결제, 법인카드 발급, 현금영수증 여부 등은{' '}
                      <span className="inline-block align-baseline">
                        <Link
                          href="/air-ticketing"
                          className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline"
                        >
                          항공권 예매 및 발권
                        </Link>
                        <span className="text-slate-700">&nbsp;페이지에서</span>
                      </span>{' '}
                      구분해 안내드립니다.
                    </p>
                  ) : (
                    <p className="mt-4 text-[15px] leading-[1.7] text-slate-700 [word-break:keep-all] [text-wrap:pretty]">
                      {block.body}
                    </p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
