import Link from 'next/link'
import RepresentativeNameImage from '@/app/components/common/RepresentativeNameImage'
import { COMPANY_FOOTER } from '@/lib/company-footer'
import { MAIN_MINIMAL_FOOTER_LINKS } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const FTC_BIZ_VERIFY_HREF =
  'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2558103455' as const

const KAKAO_CHANNEL_HREF = 'https://pf.kakao.com/_xlxjrxlX' as const

function BongtourBrandBadge() {
  return (
    <span
      className="inline-flex items-center rounded-md bg-bt-bg-lavender/10 px-2.5 py-1 text-xs font-medium leading-none"
      aria-label="Bong투어"
    >
      <span className="text-bt-brand-gold-strong">B</span>
      <span className="text-bt-bg-lavender">ong</span>
      <span className="text-bt-accent">투어</span>
    </span>
  )
}

/**
 * 전역 공통 푸터 — 하단 회사·안내 영역 (가독성·정보 위계)
 * 메모리 #28 다크 네이비 톤 + 헤더 IA 정렬 사이트맵.
 */
export default function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer
      id="site-about"
      className="mt-auto border-t-[0.5px] border-bt-bg-lavender/20 bg-bt-text-navy text-bt-bg-lavender"
    >
      <div className={`${SITE_CONTENT_CLASS} py-4 sm:py-5`}>
        {/* 회사명 + Bong투어 배지 */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-base font-medium tracking-tight text-bt-trust-beige">
            {COMPANY_FOOTER.legalName}
          </span>
          <BongtourBrandBadge />
        </div>

        <nav
          className="mt-3 border-t-[0.5px] border-bt-bg-lavender/20 pt-3"
          aria-label="하단 서비스 링크"
        >
          <ul className="flex flex-wrap gap-x-[14px] gap-y-2 text-[13px] leading-snug text-bt-bg-lavender/90">
            {MAIN_MINIMAL_FOOTER_LINKS.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link
                  href={item.href}
                  className="transition hover:text-bt-brand-gold-strong hover:underline hover:underline-offset-2"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* 카카오 채널 (오픈카톡과 별도) */}
        <div className="mt-3 border-t-[0.5px] border-bt-bg-lavender/20 pt-3">
          <p className="text-[13px] leading-snug text-bt-bg-lavender/90">봉투어 카카오 채널 추가하고 새 여행 소식 받기</p>
          <a
            href={KAKAO_CHANNEL_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-10 items-center justify-center rounded-md bg-[#FAE100] px-4 py-2 text-sm font-semibold text-[#3c1e1e] shadow-sm transition hover:brightness-95"
          >
            카카오 채널 바로가기
          </a>
        </div>

        {/* 회사 정보 — 라벨 110px · 값 1fr (모바일 stack), 5행 콤팩트 */}
        <dl className="mt-3 space-y-2.5 border-t-[0.5px] border-bt-bg-lavender/20 pt-3 text-xs text-bt-bg-lavender sm:text-[12px]">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-x-4">
            <dt className="font-medium leading-relaxed text-bt-trust-beige sm:shrink-0">대표자</dt>
            <dd className="leading-relaxed text-bt-bg-lavender">
              <RepresentativeNameImage compact className="max-sm:mt-0.5" />
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:items-start sm:gap-x-4">
            <dt className="pt-px font-medium leading-relaxed text-bt-trust-beige sm:shrink-0">사업자등록</dt>
            <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-relaxed text-bt-bg-lavender">
              <span className="font-medium text-white/90">{COMPANY_FOOTER.bizRegNo}</span>
              <span className="text-bt-bg-lavender/35" aria-hidden="true">
                ·
              </span>
              <span className="text-white/90">
                통신판매업 {COMPANY_FOOTER.mailOrderReportNo}
              </span>
              <span className="text-bt-bg-lavender/35" aria-hidden="true">
                ·
              </span>
              <span className="text-white/90">관광사업자등록 제2024-0033호</span>
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:items-start sm:gap-x-4">
            <dt className="pt-px font-medium leading-relaxed text-bt-trust-beige sm:shrink-0">주소</dt>
            <dd className="leading-relaxed text-white/90">{COMPANY_FOOTER.addressLine}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-x-4">
            <dt className="font-medium leading-relaxed text-bt-trust-beige sm:shrink-0">연락처</dt>
            <dd className="flex flex-wrap items-center gap-x-1.5 gap-y-1 leading-relaxed text-white/90">
              <span>
                전화{' '}
                <a
                  href={COMPANY_FOOTER.phoneTel}
                  className="font-medium text-bt-trust-beige underline-offset-2 hover:text-bt-brand-gold-strong hover:underline"
                >
                  {COMPANY_FOOTER.phoneDisplay}
                </a>
              </span>
              <span className="text-bt-bg-lavender/35" aria-hidden="true">
                ·
              </span>
              <span>팩스 {COMPANY_FOOTER.faxDisplay}</span>
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-[110px_1fr] sm:items-center sm:gap-x-4">
            <dt className="font-medium leading-relaxed text-bt-trust-beige sm:shrink-0">이메일</dt>
            <dd className="leading-relaxed">
              <a
                href={COMPANY_FOOTER.emailHref}
                className="text-white/90 underline-offset-2 hover:text-bt-brand-gold-strong hover:underline"
              >
                {COMPANY_FOOTER.emailDisplay}
              </a>
            </dd>
          </div>
        </dl>

        {/* 상담 가능 시간 */}
        <div
          className="mt-3 rounded-r-md border-l-2 border-bt-brand-gold-strong border-t-[0.5px] border-bt-bg-lavender/20 px-3 py-2.5 pt-3"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--bt-brand-gold-strong) 12%, transparent)',
          }}
        >
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xs font-medium text-bt-brand-gold-strong">상담 가능 시간</span>
            <span className="text-sm font-medium text-bt-trust-beige">평일 08:00 ~ 19:00</span>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-bt-bg-lavender/70">
            간단한 문의·예약 상담은 <span className="text-bt-bg-lavender">오픈카톡</span>
            <span className="text-bt-bg-lavender/40"> · </span>
            급한 문의는 <span className="text-bt-bg-lavender">전화</span>
            <span className="text-bt-bg-lavender/40"> · </span>
            자료 첨부가 필요한 경우 <span className="text-bt-bg-lavender">이메일</span>을 이용해 주세요
          </p>
        </div>

        {/* 저작권 · 사업자정보확인 */}
        <div className="mt-3 flex flex-col gap-2 border-t-[0.5px] border-bt-bg-lavender/20 pt-3 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2">
          <p className="text-bt-bg-lavender/50">
            © {year} {COMPANY_FOOTER.copyrightHolder}. All rights reserved.
          </p>
          <span className="hidden select-none text-bt-bg-lavender/25 sm:inline" aria-hidden="true">
            ·
          </span>
          <a
            href={FTC_BIZ_VERIFY_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="text-bt-bg-lavender/60 transition hover:text-bt-brand-gold-strong hover:underline hover:underline-offset-2"
          >
            사업자정보확인
          </a>
        </div>
      </div>
    </footer>
  )
}
