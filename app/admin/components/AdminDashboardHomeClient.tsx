'use client'

/**
 * 관리자 홈: KPI(비동기) + 빠른 액션(즉시).
 * REGRESSION-FREEZE[admin-dashboard-kpi-shell-first]: KPI는 API, 액션은 셸 — manifest
 * REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: affiliationPendingCount CTA — manifest
 * REGRESSION-FREEZE[admin-mobile-ops-b-register]: data-admin-mobile-dashboard-actions — manifest
 */
import { useState } from 'react'
import Link from 'next/link'
import {
  ADMIN_BTN_PRIMARY_CLASS,
  ADMIN_BTN_SECONDARY_CLASS,
  ADMIN_SECTION_TITLE_CLASS,
} from '@/lib/admin-design-system'
import type { AdminDashboardKpi } from '@/lib/admin/dashboard-kpi'
import AdminDashboardKpiSection from './AdminDashboardKpiSection'

type Props = {
  query: string
}

export default function AdminDashboardHomeClient({ query }: Props) {
  const [affiliationPendingCount, setAffiliationPendingCount] = useState<number | null>(null)

  return (
    <>
      <AdminDashboardKpiSection
        query={query}
        onKpi={(kpi: AdminDashboardKpi) => {
          setAffiliationPendingCount(kpi.affiliationPendingCount)
        }}
      />

      {/* REGRESSION-FREEZE[admin-mobile-ops-b-register]: dashboard phone-first quick actions — manifest */}
      <section className="mb-8" data-admin-mobile-dashboard-actions="true">
        <h2 className={ADMIN_SECTION_TITLE_CLASS}>빠른 액션</h2>
        <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
          <Link
            href={`/admin/bongsim/affiliation-cards${query}`}
            className={`${ADMIN_BTN_PRIMARY_CLASS} min-h-12 w-full sm:w-auto`}
          >
            소속 명함 승인
            {affiliationPendingCount != null && affiliationPendingCount > 0
              ? ` (${affiliationPendingCount})`
              : ''}
          </Link>
          <Link href={`/admin/register${query}`} className={`${ADMIN_BTN_PRIMARY_CLASS} min-h-12 w-full sm:w-auto`}>
            상품 등록
          </Link>
          <Link href={`/admin/bookings${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
            상담·예약
          </Link>
          <Link href={`/admin/inquiries${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
            문의 접수
          </Link>
          <Link href={`/admin/pending${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
            등록대기
          </Link>
          <Link href={`/admin/products${query}`} className={`${ADMIN_BTN_SECONDARY_CLASS} min-h-12 w-full sm:w-auto`}>
            상품 목록
          </Link>
          <Link
            href={`/admin/training-programs/new${query}`}
            className={`${ADMIN_BTN_SECONDARY_CLASS} hidden min-h-12 w-full sm:inline-flex sm:w-auto`}
          >
            국외연수 프로그램 등록
          </Link>
          <Link
            href={`/admin/brands${query}`}
            className={`${ADMIN_BTN_SECONDARY_CLASS} hidden min-h-12 w-full sm:inline-flex sm:w-auto`}
          >
            브랜드 관리
          </Link>
        </div>
      </section>
    </>
  )
}
