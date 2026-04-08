import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { maskEmail, maskPhone } from '@/lib/pii'
import {
  type AdminInquiryListItem,
  isCustomerInquiryType,
  isInquiryAdminStatus,
  isLeadTimeRisk,
  sortInquiriesByRiskThenDate,
} from '@/lib/admin-inquiry'

/**
 * GET /api/admin/inquiries
 * Query: inquiryType?, status?, leadTimeRisk? (허용값만 적용, 그 외 무시)
 * 정렬: leadTimeRisk (urgent → late → normal) → createdAt desc
 * 인증 실패: 401 JSON
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const isSuper = admin.user.role === 'SUPER_ADMIN'
  const { searchParams } = new URL(request.url)
  const rawType = searchParams.get('inquiryType') ?? undefined
  const rawStatus = searchParams.get('status') ?? undefined
  const rawRisk = searchParams.get('leadTimeRisk') ?? undefined

  const where: {
    inquiryType?: string
    status?: string
    leadTimeRisk?: string
  } = {}
  if (rawType && isCustomerInquiryType(rawType)) where.inquiryType = rawType
  if (rawStatus && isInquiryAdminStatus(rawStatus)) where.status = rawStatus
  if (rawRisk && isLeadTimeRisk(rawRisk)) where.leadTimeRisk = rawRisk

  try {
    const rows = await prisma.customerInquiry.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        inquiryType: true,
        status: true,
        leadTimeRisk: true,
        applicantName: true,
        applicantPhone: true,
        applicantEmail: true,
        snapshotProductTitle: true,
        snapshotCardLabel: true,
        sourcePagePath: true,
        productId: true,
        monthlyCurationItemId: true,
        payloadJson: true,
        preferredContactChannel: true,
        selectedServiceType: true,
        privacyNoticeConfirmedAt: true,
        emailSentStatus: true,
        emailSentAt: true,
      },
    })

    const sorted = sortInquiriesByRiskThenDate(rows)

    const inquiries: AdminInquiryListItem[] = sorted.map((r) => ({
      ...(() => {
        let quoteKind: string | null = null
        let consultType: string | null = null
        let destinationSummary: string | null = null
        let departureDateOrMonth: string | null = null
        let headcount: number | null = null
        let organizationName: string | null = null
        let trainingPurpose: string | null = null
        try {
          const payload = r.payloadJson ? (JSON.parse(r.payloadJson) as Record<string, unknown>) : null
          if (payload && typeof payload === 'object') {
            if (typeof payload.quoteKind === 'string' && payload.quoteKind.trim()) quoteKind = payload.quoteKind.trim()
            if (typeof payload.consultType === 'string' && payload.consultType.trim()) consultType = payload.consultType.trim()
            if (typeof payload.destinationSummary === 'string' && payload.destinationSummary.trim()) {
              destinationSummary = payload.destinationSummary.trim()
            }
            if (typeof payload.organizationName === 'string' && payload.organizationName.trim()) {
              organizationName = payload.organizationName.trim()
            }
            if (typeof payload.trainingPurpose === 'string' && payload.trainingPurpose.trim()) {
              trainingPurpose = payload.trainingPurpose.trim()
            }
            const depDate =
              typeof payload.preferredDepartureDate === 'string' ? payload.preferredDepartureDate.trim() : ''
            const depMonth =
              typeof payload.preferredDepartureMonth === 'string' ? payload.preferredDepartureMonth.trim() : ''
            departureDateOrMonth = depDate || depMonth || null
            if (typeof payload.headcount === 'number' && Number.isFinite(payload.headcount)) {
              headcount = Math.max(1, Math.trunc(payload.headcount))
            }
          }
        } catch {
          // payload 파싱 실패는 목록 렌더를 막지 않는다.
        }
        return {
          consultType,
          quoteKind,
          destinationSummary,
          departureDateOrMonth,
          headcount,
          organizationName,
          trainingPurpose,
          preferredContactChannel:
            r.preferredContactChannel === 'email' ||
            r.preferredContactChannel === 'kakao' ||
            r.preferredContactChannel === 'both'
              ? r.preferredContactChannel
              : null,
          selectedServiceType: r.selectedServiceType,
          privacyNoticeConfirmed: Boolean(r.privacyNoticeConfirmedAt),
          privacyNoticeConfirmedAt: r.privacyNoticeConfirmedAt
            ? r.privacyNoticeConfirmedAt.toISOString()
            : null,
          emailSentStatus: r.emailSentStatus,
          emailSentAt: r.emailSentAt ? r.emailSentAt.toISOString() : null,
        }
      })(),
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      inquiryType: r.inquiryType,
      status: r.status,
      leadTimeRisk: r.leadTimeRisk,
      applicantName: r.applicantName,
      applicantPhone: isSuper ? r.applicantPhone : maskPhone(r.applicantPhone),
      applicantEmail:
        r.applicantEmail == null
          ? null
          : isSuper
            ? r.applicantEmail
            : maskEmail(r.applicantEmail),
      snapshotProductTitle: r.snapshotProductTitle,
      snapshotCardLabel: r.snapshotCardLabel,
      sourcePagePath: r.sourcePagePath,
      productId: r.productId,
      monthlyCurationItemId: r.monthlyCurationItemId,
    }))

    return NextResponse.json({ inquiries })
  } catch (e) {
    console.error('[GET /api/admin/inquiries]', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
