import {
  MAIN_TRUST_B2G_ENTITY_CHIPS,
  MAIN_TRUST_B2G_SUBTITLE,
  MAIN_TRUST_B2G_TITLE,
} from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/**
 * B2G 신뢰 밴드 (v5 시안) — 라벤더 베이스 · 흰 칩 · 다크 네이비 텍스트 (메모리 #27).
 */
export default function HomeTrustSection() {
  return (
    <section
      id="trust-band"
      className="scroll-mt-24 border-b border-bt-border-soft/80 bg-gradient-to-b from-bt-bg-lavender-soft via-white to-bt-bg-lavender/35 py-10 sm:py-12"
      aria-labelledby="home-trust-b2g-heading"
    >
      <div className={`text-center ${SITE_CONTENT_CLASS}`}>
        <h2
          id="home-trust-b2g-heading"
          className="text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          {MAIN_TRUST_B2G_TITLE}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-bt-text-muted-lavender sm:mt-3.5 sm:text-[0.9375rem]">
          {MAIN_TRUST_B2G_SUBTITLE}
        </p>
        <ul
          className="mt-6 flex flex-wrap justify-center gap-2 sm:mt-8 sm:gap-2.5"
          aria-label="협력·수행 기관 예시"
        >
          {MAIN_TRUST_B2G_ENTITY_CHIPS.map((label) => (
            <li key={label}>
              <span className="inline-flex min-h-[2.25rem] items-center rounded-full border border-bt-border-soft bg-white px-3.5 py-1.5 text-xs font-semibold text-bt-text-navy shadow-sm ring-1 ring-bt-border-soft/40 sm:px-4 sm:text-sm">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
