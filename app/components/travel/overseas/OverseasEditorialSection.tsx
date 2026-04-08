import Link from 'next/link'
import {
  OVERSEAS_EDITORIAL_SAMPLES,
  OVERSEAS_LANDING_SECTIONS,
} from '@/lib/overseas-landing-copy'

export default function OverseasEditorialSection() {
  return (
    <section
      id="travel-os-editorial"
      className="scroll-mt-24 border-t-2 border-bt-border bg-gradient-to-b from-white to-bt-surface/40 py-14 sm:py-16"
      aria-labelledby="travel-os-editorial-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bt-muted">
          {OVERSEAS_LANDING_SECTIONS.editorialEyebrow}
        </p>
        <h2
          id="travel-os-editorial-heading"
          className="mt-2 text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl"
        >
          {OVERSEAS_LANDING_SECTIONS.editorialTitle}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bt-muted">
          {OVERSEAS_LANDING_SECTIONS.editorialLead}
        </p>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {OVERSEAS_EDITORIAL_SAMPLES.map((card) => (
            <li
              key={card.id}
              className="flex flex-col rounded-2xl border border-bt-border bg-bt-surface p-5 shadow-sm transition hover:border-bt-accent/30 hover:shadow-md"
            >
              <span className="text-[10px] font-semibold uppercase tracking-wider text-bt-accent">{card.tag}</span>
              <h3 className="mt-2 text-base font-semibold leading-snug text-bt-ink">{card.title}</h3>
              <p className="mt-2 flex-1 text-xs leading-relaxed text-bt-muted">{card.dek}</p>
              <span className="mt-4 text-[11px] font-medium text-bt-subtle">브리핑 샘플 · 상품 카드와 별도 축 · 추후 CMS 연동</span>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-center text-sm text-bt-muted">
          상담이 필요하신가요?{' '}
          <Link href="/inquiry?type=travel&source=/travel/overseas" className="font-medium text-bt-link underline-offset-2 hover:text-bt-link-hover hover:underline">
            해외여행 상담 신청
          </Link>
        </p>
      </div>
    </section>
  )
}
