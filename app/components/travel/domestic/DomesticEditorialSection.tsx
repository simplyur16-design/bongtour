import Link from 'next/link'
import { DOMESTIC_EDITORIAL_SAMPLES, DOMESTIC_LANDING_SECTIONS } from '@/lib/domestic-landing-copy'

export default function DomesticEditorialSection() {
  return (
    <section
      id="travel-dm-editorial"
      className="scroll-mt-24 border-t-2 border-bt-border bg-gradient-to-b from-white to-bt-surface/40 py-14 sm:py-16"
      aria-labelledby="travel-dm-editorial-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-muted">
          {DOMESTIC_LANDING_SECTIONS.exploreEyebrow}
        </p>
        <h2
          id="travel-dm-editorial-heading"
          className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl"
        >
          지역 브리핑 — 상품과 다른 축
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">
          수원 방문의 해, 전주 한옥, 여수 밤바다처럼 지역 서사를 먼저 짚습니다. 일정·요금 카드와 톤을 달리하며, 향후 관리자·CMS로 확장할 수
          있는 자리입니다.
        </p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOMESTIC_EDITORIAL_SAMPLES.map((card) => (
            <li
              key={card.id}
              className="flex flex-col rounded-2xl border border-bt-border bg-bt-surface p-5 shadow-sm transition hover:border-bt-accent/30 hover:shadow-md"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-bt-accent">{card.tag}</span>
              <h3 className="mt-2 text-base font-semibold leading-snug text-bt-ink">{card.title}</h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-bt-muted">{card.dek}</p>
              <span className="mt-4 text-[11px] font-medium text-bt-subtle">브리핑 샘플 · 상품 카드와 분리</span>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-bt-muted">
          단체·워크숍·전세 이동은{' '}
          <Link href="/charter-bus" className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline">
            전세버스 안내
          </Link>
          와 함께 보실 수 있습니다.
        </p>
      </div>
    </section>
  )
}
