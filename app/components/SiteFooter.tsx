import Link from 'next/link'
import Image from 'next/image'
import RepresentativeNameImage from '@/app/components/common/RepresentativeNameImage'
import { COMPANY_FOOTER } from '@/lib/company-footer'
import { MAIN_MINIMAL_FOOTER_LINKS } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/**
 * 전역 공통 푸터 — 짧은 하단 정보영역(압축 corporate footer)
 */
export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer id="site-about" className="mt-auto border-t border-slate-800 bg-slate-950 text-slate-400">
      <div className={`${SITE_CONTENT_CLASS} py-4 sm:py-5`}>
        {/* 텍스트 상호명 중심 + 보조 소형 로고 */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-semibold tracking-tight text-slate-100 sm:text-sm">
            {COMPANY_FOOTER.legalName}
          </span>
          <Link
            href="/"
            className="inline-flex shrink-0 items-center opacity-80 transition hover:opacity-100"
            aria-label="봉투어 홈"
          >
            <Image
              src="/images/bongtour-logo.webp"
              alt=""
              width={96}
              height={28}
              className="h-4 w-auto object-contain object-left brightness-0 invert sm:h-[1.125rem]"
            />
          </Link>
        </div>

        {/* 보조 링크 — 한두 줄 · 작은 글자 */}
        <nav className="mt-2.5 border-t border-slate-800/90 pt-2.5" aria-label="하단 서비스 링크">
          <ul className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] leading-tight text-slate-500 sm:gap-x-3 sm:text-[12px]">
            {MAIN_MINIMAL_FOOTER_LINKS.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className="transition hover:text-slate-300 hover:underline hover:underline-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* 회사정보 — 촘촘한 블록 */}
        <div className="mt-2.5 space-y-1 border-t border-slate-800/90 pt-2.5 text-[11px] leading-snug sm:text-[12px] sm:leading-relaxed">
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            <span className="text-slate-500">대표자</span>
            <RepresentativeNameImage compact className="mx-0.5" />
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>
              사업자등록번호 {COMPANY_FOOTER.bizRegNo}
              <span className="text-slate-600" aria-hidden="true">
                {' '}
                ·{' '}
              </span>
              통신판매업 신고번호 {COMPANY_FOOTER.mailOrderReportNo}
            </span>
          </p>

          <p>{COMPANY_FOOTER.addressLine}</p>

          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span>
              전화{' '}
              <a
                href={COMPANY_FOOTER.phoneTel}
                className="font-medium text-slate-300 underline-offset-2 hover:text-white hover:underline"
              >
                {COMPANY_FOOTER.phoneDisplay}
              </a>
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>팩스 {COMPANY_FOOTER.faxDisplay}</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>
              이메일{' '}
              <a
                href={COMPANY_FOOTER.emailHref}
                className="text-slate-300 underline-offset-2 hover:text-white hover:underline"
              >
                {COMPANY_FOOTER.emailDisplay}
              </a>
            </span>
          </p>
          <p className="text-slate-500">
            상담 가능 시간 08:00~19:00 · 간단한 문의/예약 상담은 오픈카톡, 급한 문의는 전화, 자료 첨부는 이메일 문의를 이용해 주세요.
          </p>
        </div>

        <p className="mt-2.5 border-t border-slate-800/90 pt-2 text-[10px] text-slate-600 sm:text-[11px]">
          © {year} {COMPANY_FOOTER.copyrightHolder}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
