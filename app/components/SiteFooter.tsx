import Link from 'next/link'
import RepresentativeNameImage from '@/app/components/common/RepresentativeNameImage'
import { COMPANY_FOOTER } from '@/lib/company-footer'
import { MAIN_MINIMAL_FOOTER_LINKS } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const FTC_BIZ_VERIFY_HREF =
  'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2558103455' as const

function BongtourBrandBadge() {
  return (
    <span
      className="inline-flex items-center rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium leading-none"
      aria-label="Bong투어"
    >
      <span className="text-[var(--bong-orange)]">B</span>
      <span className="text-white/90">ong</span>
      <span className="text-[#4FD1C5]">투어</span>
    </span>
  )
}

/**
 * 전역 공통 푸터 — 하단 회사·안내 영역 (가독성·정보 위계)
 */
export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer id="site-about" className="mt-auto border-t-[0.5px] border-white/[0.14] bg-slate-950 text-white/90">
      <div className={`${SITE_CONTENT_CLASS} py-4 sm:py-5`}>
        {/* 회사명 + Bong투어 배지 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-base font-medium tracking-tight text-white/95">{COMPANY_FOOTER.legalName}</span>
          <BongtourBrandBadge />
        </div>

        <nav
          className="border-t-[0.5px] border-white/[0.14] pt-4 mt-4"
          aria-label="하단 서비스 링크"
        >
          <ul className="flex flex-wrap gap-x-[14px] gap-y-[22px] text-[13px] leading-snug text-white/[0.88]">
            {MAIN_MINIMAL_FOOTER_LINKS.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className="transition hover:text-white hover:underline hover:underline-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* 회사 정보 — 라벨 110px · 값 1fr (모바일 stack) */}
        <dl className="border-t-[0.5px] border-white/[0.14] pt-4 mt-4 space-y-3 text-xs leading-relaxed sm:text-[12px]">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-center">
            <dt className="text-white/[0.55] sm:shrink-0">대표자</dt>
            <dd className="text-white/90">
              <RepresentativeNameImage compact className="max-sm:mt-0.5" />
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-center">
            <dt className="text-white/[0.55] sm:shrink-0">사업자등록번호</dt>
            <dd className="text-white/90">{COMPANY_FOOTER.bizRegNo}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-center">
            <dt className="text-white/[0.55] sm:shrink-0">통신판매업</dt>
            <dd className="text-white/90">{COMPANY_FOOTER.mailOrderReportNo}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-center">
            <dt className="text-white/[0.55] sm:shrink-0">관광사업자등록</dt>
            <dd className="text-white/90">제2024-0033호</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-start">
            <dt className="text-white/[0.55] sm:shrink-0 pt-px">주소</dt>
            <dd className="text-white/90">{COMPANY_FOOTER.addressLine}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-center">
            <dt className="text-white/[0.55] sm:shrink-0">연락처</dt>
            <dd className="flex flex-wrap items-center gap-x-2 gap-y-1 text-white/90">
              <span>
                전화{' '}
                <a
                  href={COMPANY_FOOTER.phoneTel}
                  className="font-medium text-white/95 underline-offset-2 hover:underline"
                >
                  {COMPANY_FOOTER.phoneDisplay}
                </a>
              </span>
              <span className="text-white/25" aria-hidden="true">
                ·
              </span>
              <span className="text-white/75">팩스 {COMPANY_FOOTER.faxDisplay}</span>
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:gap-x-4 sm:items-center">
            <dt className="text-white/[0.55] sm:shrink-0">이메일</dt>
            <dd>
              <a
                href={COMPANY_FOOTER.emailHref}
                className="text-[#4FD1C5] underline-offset-2 hover:underline"
              >
                {COMPANY_FOOTER.emailDisplay}
              </a>
            </dd>
          </div>
        </dl>

        {/* 상담 가능 시간 */}
        <div
          className="mt-4 border-t-[0.5px] border-white/[0.14] pt-4 rounded-r-md border-l-2 border-[var(--bong-orange)] p-3 sm:mt-5"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bong-orange) 8%, transparent)',
          }}
        >
          <p className="text-xs font-medium text-[var(--bong-orange)]">상담 가능 시간</p>
          <p className="mt-1 text-sm font-medium text-white/95">평일 08:00 ~ 19:00</p>
          <p className="mt-2 text-xs leading-relaxed text-white/70">
            간단한 문의·예약 상담은 <span className="text-white/90">오픈카톡</span>
            <span className="text-white/40"> · </span>
            급한 문의는 <span className="text-white/90">전화</span>
            <span className="text-white/40"> · </span>
            자료 첨부가 필요한 경우 <span className="text-white/90">이메일</span>을 이용해 주세요
          </p>
        </div>

        {/* 저작권 · 사업자정보확인 */}
        <div className="flex flex-col gap-2 border-t-[0.5px] border-white/[0.14] pt-4 mt-4 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
          <p className="text-white/50">
            © {year} {COMPANY_FOOTER.copyrightHolder}. All rights reserved.
          </p>
          <span className="hidden select-none text-white/25 sm:inline" aria-hidden="true">
            ·
          </span>
          <a
            href={FTC_BIZ_VERIFY_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/[0.60] transition hover:text-white/80 hover:underline hover:underline-offset-2"
          >
            사업자정보확인
          </a>
        </div>
      </div>
    </footer>
  )
}
