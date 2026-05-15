'use client'

import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import PartnerOrganizationsRotator from './PartnerOrganizationsRotator'

/**
 * 주요 거래·협력 기관 마퀴 — 훈련·항공권 등에서 단독 섹션.
 * 메인은 `HomeTrustSection` 안에 `PartnerOrganizationsRotator`만 합류.
 */
export default function PartnerOrganizationsSection({
  showHeading = true,
  showLead = true,
}: {
  showHeading?: boolean
  showLead?: boolean
}) {
  return (
    <section
      className="border-t border-slate-200/70 bg-white py-10 md:py-12"
      aria-labelledby={showHeading ? 'partner-orgs-heading' : undefined}
    >
      <div className={SITE_CONTENT_CLASS}>
        {showHeading ? (
          <h2
            id="partner-orgs-heading"
            className="text-center text-base font-semibold tracking-tight text-slate-800 md:text-lg"
          >
            주요 거래·협력 기관 및 지자체
          </h2>
        ) : null}
        {showLead ? (
          <p className="mx-auto mt-2 max-w-2xl text-center text-[13px] leading-relaxed text-slate-600 sm:text-sm">
            봉투어가 실제 상담·진행·연수·행사 운영 등의 업무를 수행한 기관 및 지자체입니다.
          </p>
        ) : null}
        <PartnerOrganizationsRotator tone="on-white" showRightsLine className="mt-8" />
      </div>
    </section>
  )
}
