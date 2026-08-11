'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import RepresentativeNameImage from '@/app/components/common/RepresentativeNameImage'
import { COMPANY_FOOTER } from '@/lib/company-footer'
import { FOOTER_POLICY_LINKS } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import KakaoChannelConsultLink from '@/components/bongtour/KakaoChannelConsultLink'

const FTC_BIZ_VERIFY_HREF =
  'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=2558103455' as const

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

function BusinessInfoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!portalReady || !open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10100] flex items-end justify-center bg-slate-900/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="footer-biz-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-bt-border bg-white p-5 shadow-xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="footer-biz-modal-title" className="text-lg font-semibold text-slate-900">
            사업자 정보
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>
        <dl className="mt-4 space-y-3 text-sm text-slate-700">
          <div>
            <dt className="font-medium text-slate-900">상호</dt>
            <dd>{COMPANY_FOOTER.legalName}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">대표자</dt>
            <dd>
              <RepresentativeNameImage tone="on-light" />
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">사업자등록번호</dt>
            <dd>{COMPANY_FOOTER.bizRegNo}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">통신판매업 신고</dt>
            <dd>{COMPANY_FOOTER.mailOrderReportNo}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">관광사업자등록</dt>
            <dd>제2024-0033호</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">주소</dt>
            <dd>{COMPANY_FOOTER.addressLine}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">연락처</dt>
            <dd>
              전화{' '}
              <a href={COMPANY_FOOTER.phoneTel} className="font-medium text-bt-link underline-offset-2 hover:underline">
                {COMPANY_FOOTER.phoneDisplay}
              </a>
              <span className="text-slate-400"> · </span>
              팩스 {COMPANY_FOOTER.faxDisplay}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-900">이메일</dt>
            <dd>
              <a href={COMPANY_FOOTER.emailHref} className="text-bt-link underline-offset-2 hover:underline">
                {COMPANY_FOOTER.emailDisplay}
              </a>
            </dd>
          </div>
        </dl>
        <a
          href={FTC_BIZ_VERIFY_HREF}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex text-sm font-medium text-bt-link underline-offset-2 hover:underline"
        >
          공정거래위원회 사업자정보확인
        </a>
      </div>
    </div>,
    document.body,
  )
}

/**
 * 전역 공통 푸터 — 모바일은 축약, 사업자 정보는 팝업
 */
export default function SiteFooter() {
  const year = new Date().getFullYear()
  const [bizOpen, setBizOpen] = useState(false)
  const openBiz = useCallback(() => setBizOpen(true), [])
  const closeBiz = useCallback(() => setBizOpen(false), [])

  return (
    <>
      <footer
        id="site-about"
        className="mt-auto border-t-[0.5px] border-bt-bg-lavender/20 bg-bt-text-navy text-bt-bg-lavender"
      >
        <div className={`${SITE_CONTENT_CLASS} py-3 sm:py-4`}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-medium tracking-tight text-bt-trust-beige sm:text-base">
              {COMPANY_FOOTER.legalName}
            </span>
            <BongtourBrandBadge />
          </div>

          <nav className="mt-2 border-t-[0.5px] border-bt-bg-lavender/20 pt-2" aria-label="정책 및 약관">
            <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-[12px] leading-snug text-bt-bg-lavender/90 sm:gap-x-[14px] sm:text-[13px]">
              {FOOTER_POLICY_LINKS.map((item) => {
                const external = /^https?:\/\//i.test(item.href)
                return (
                  <li key={`${item.href}-${item.label}`}>
                    {external ? (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition hover:text-bt-brand-gold-strong hover:underline hover:underline-offset-2"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        href={item.href}
                        className="transition hover:text-bt-brand-gold-strong hover:underline hover:underline-offset-2"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* 데스크톱: 사업자 정보 인라인 */}
          <dl className="mt-2 hidden space-y-2.5 border-t-[0.5px] border-bt-bg-lavender/20 pt-2 text-xs text-bt-bg-lavender sm:block sm:text-[12px]">
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
                <span className="text-white/90">통신판매업 {COMPANY_FOOTER.mailOrderReportNo}</span>
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

          {/* 모바일 전용 — SSR/CSR 동일 마크업 (hydration 시 DOM 순서 유지) */}
          <div
            className="mt-2 border-t-[0.5px] border-bt-bg-lavender/20 pt-2 sm:hidden"
            suppressHydrationWarning
          >
            <button
              type="button"
              onClick={openBiz}
              className="w-full rounded-lg border border-bt-bg-lavender/30 bg-white/5 px-3 py-2.5 text-left text-sm font-semibold text-bt-trust-beige hover:bg-white/10 active:bg-white/15"
            >
              사업자 정보 확인
            </button>
          </div>

          <div
            className="mt-2 rounded-r-md border-l-2 border-bt-brand-gold-strong border-t-[0.5px] border-bt-bg-lavender/20 px-3 py-2 pt-2 sm:py-2.5"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--bt-brand-gold-strong) 12%, transparent)',
            }}
          >
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[11px] font-medium text-bt-brand-gold-strong sm:text-xs">상담 가능 시간</span>
              <span className="text-xs font-medium text-bt-trust-beige sm:text-sm">평일 08:00 ~ 19:00</span>
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <KakaoChannelConsultLink className="w-full text-xs sm:w-auto" />
              <p className="text-xs leading-relaxed text-bt-bg-lavender/70">
                급한 문의는 <span className="text-bt-bg-lavender">전화</span>
                <span className="text-bt-bg-lavender/40"> · </span>
                자료 첨부가 필요한 경우 <span className="text-bt-bg-lavender">이메일</span>을 이용해 주세요
              </p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t-[0.5px] border-bt-bg-lavender/20 pt-2 text-[11px] sm:text-xs">
            <p className="text-bt-bg-lavender/50">
              © {year} {COMPANY_FOOTER.copyrightHolder}
            </p>
            <a
              href={FTC_BIZ_VERIFY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-bt-bg-lavender/60 transition hover:text-bt-brand-gold-strong hover:underline sm:inline"
            >
              사업자정보확인
            </a>
          </div>
        </div>
      </footer>
      <BusinessInfoModal open={bizOpen} onClose={closeBiz} />
    </>
  )
}
