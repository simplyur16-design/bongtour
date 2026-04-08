import { MAIN_TRUST_HIGHLIGHTS, MAIN_TRUST_LEAD, MAIN_TRUST_TITLE } from '@/lib/main-hub-copy'

/**
 * 신뢰 밴드 — 짧은 리드 + 3카드. 약관 톤 지양.
 */
export default function HomeTrustSection() {
  return (
    <section
      id="trust-band"
      className="scroll-mt-24 border-b border-bt-border bg-bt-page py-14 sm:py-16"
      aria-labelledby="home-trust-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bt-muted">Trust</p>
        <h2 id="home-trust-heading" className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl">
          {MAIN_TRUST_TITLE}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bt-muted sm:text-[0.95rem]">{MAIN_TRUST_LEAD}</p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-3">
          {MAIN_TRUST_HIGHLIGHTS.map((h) => (
            <li
              key={h.title}
              className="flex flex-col rounded-xl border border-bt-border bg-bt-surface px-5 py-5 shadow-sm"
            >
              <h3 className="text-sm font-semibold text-bt-ink">{h.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-bt-muted">{h.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
