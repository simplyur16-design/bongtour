import { MAIN_TRUST_B2G_SUBTITLE, MAIN_TRUST_B2G_TITLE } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import PartnerOrganizationsRotator from '@/app/components/home/PartnerOrganizationsRotator'

/**
 * B2G 신뢰 밴드 + 협력 기관 로고 마퀴 (한 섹션).
 * 라벤더 베이스 · 다크 네이비 텍스트 (메모리 #27).
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

        <div className="mt-8 sm:mt-10">
          <PartnerOrganizationsRotator tone="on-lavender" deferMount showRightsLine />
        </div>
      </div>
    </section>
  )
}
