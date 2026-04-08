import { CUSTOMER_INQUIRY_TYPES, type CustomerInquiryType } from '@/lib/customer-inquiry-intake'

/** GET /api/admin/inquiries 목록 한 행 (마스킹 적용 후 응답) */
export type AdminInquiryListItem = {
  id: string
  createdAt: string
  inquiryType: string
  status: string
  leadTimeRisk: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  sourcePagePath: string | null
  productId: string | null
  monthlyCurationItemId: string | null
  consultType: string | null
  quoteKind: string | null
  destinationSummary: string | null
  departureDateOrMonth: string | null
  headcount: number | null
  organizationName: string | null
  trainingPurpose: string | null
  preferredContactChannel: 'email' | 'kakao' | 'both' | null
  selectedServiceType: string | null
  privacyNoticeConfirmed: boolean
  privacyNoticeConfirmedAt: string | null
  emailSentStatus: string | null
  emailSentAt: string | null
}

export function preferredContactChannelLabel(channel: AdminInquiryListItem['preferredContactChannel']): string {
  if (channel === 'email') return '이메일'
  if (channel === 'kakao') return '카카오톡'
  if (channel === 'both') return '둘 다'
  return '—'
}

export function preferredContactChannelBadgeClass(
  channel: AdminInquiryListItem['preferredContactChannel']
): string {
  if (channel === 'email') return 'bg-slate-50 text-slate-700 border-slate-200'
  if (channel === 'kakao') return 'bg-yellow-50 text-yellow-900 border-yellow-300 font-semibold'
  if (channel === 'both') return 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
  return 'bg-gray-50 text-gray-500 border-gray-200'
}

/** PATCH 및 필터에 사용하는 문의 상태 */
export const INQUIRY_ADMIN_STATUSES = [
  'received',
  'reviewing',
  'contacting',
  'contacted',
  'quoted',
  'scheduled',
  'closed',
  'cancelled',
  'dropped',
] as const

export type InquiryAdminStatus = (typeof INQUIRY_ADMIN_STATUSES)[number]

export const INQUIRY_LEAD_TIME_RISKS = ['urgent', 'late', 'normal'] as const
export type InquiryLeadTimeRisk = (typeof INQUIRY_LEAD_TIME_RISKS)[number]

export function isInquiryAdminStatus(s: string): s is InquiryAdminStatus {
  return (INQUIRY_ADMIN_STATUSES as readonly string[]).includes(s)
}

export function isCustomerInquiryType(s: string): s is CustomerInquiryType {
  return (CUSTOMER_INQUIRY_TYPES as readonly string[]).includes(s)
}

export function isLeadTimeRisk(s: string): s is InquiryLeadTimeRisk {
  return (INQUIRY_LEAD_TIME_RISKS as readonly string[]).includes(s)
}

/** 목록 정렬: urgent → late → normal → 기타, 동순위는 createdAt 최신순 */
export function leadTimeRiskSortRank(risk: string): number {
  if (risk === 'urgent') return 0
  if (risk === 'late') return 1
  if (risk === 'normal') return 2
  return 3
}

export function sortInquiriesByRiskThenDate<
  T extends { leadTimeRisk: string; createdAt: Date | string },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ra = leadTimeRiskSortRank(a.leadTimeRisk)
    const rb = leadTimeRiskSortRank(b.leadTimeRisk)
    if (ra !== rb) return ra - rb
    const ta = typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt.getTime()
    const tb = typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt.getTime()
    return tb - ta
  })
}

export const INQUIRY_TYPE_LABELS: Record<CustomerInquiryType, string> = {
  travel_consult: '일반 여행 상담',
  institution_request: '연수기관 섭외',
  overseas_training_quote: '국외연수 견적',
  bus_quote: '전세버스 견적',
}

export function inquiryTypeLabel(type: string): string {
  if (isCustomerInquiryType(type)) return INQUIRY_TYPE_LABELS[type]
  return type
}

export function inquiryTypeDisplayLabel(type: string, quoteKind: string | null): string {
  if (type === 'travel_consult' && quoteKind === 'private_custom') return '단독견적 문의'
  return inquiryTypeLabel(type)
}

export const INQUIRY_STATUS_LABELS: Record<InquiryAdminStatus, string> = {
  received: '접수',
  reviewing: '검토중',
  contacting: '연락중',
  contacted: '연락완료',
  quoted: '견적',
  scheduled: '일정조율',
  closed: '종료',
  cancelled: '취소',
  dropped: '종료(불발)',
}

export function inquiryStatusLabel(status: string): string {
  if (isInquiryAdminStatus(status)) return INQUIRY_STATUS_LABELS[status]
  return status
}

export const LEAD_TIME_RISK_LABELS: Record<InquiryLeadTimeRisk, string> = {
  urgent: '긴급',
  late: '촉박',
  normal: '보통',
}

export function leadTimeRiskLabel(risk: string): string {
  if (isLeadTimeRisk(risk)) return LEAD_TIME_RISK_LABELS[risk]
  return risk
}

/** 상태 배지 Tailwind (AdminStatusBadge와 별도 — 문의 전용 톤) */
export function inquiryStatusBadgeClass(status: string): string {
  switch (status) {
    case 'received':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    case 'reviewing':
      return 'bg-amber-50 text-amber-900 border-amber-200'
    case 'contacted':
      return 'bg-sky-50 text-sky-900 border-sky-200'
    case 'contacting':
      return 'bg-cyan-50 text-cyan-900 border-cyan-200'
    case 'quoted':
      return 'bg-violet-50 text-violet-900 border-violet-200'
    case 'scheduled':
      return 'bg-indigo-50 text-indigo-900 border-indigo-200'
    case 'closed':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
    case 'dropped':
      return 'bg-gray-100 text-gray-600 border-gray-200'
    case 'cancelled':
      return 'bg-zinc-100 text-zinc-700 border-zinc-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

export function leadTimeRiskBadgeClass(risk: string): string {
  switch (risk) {
    case 'urgent':
      return 'bg-red-100 text-red-900 border-red-300 font-semibold'
    case 'late':
      return 'bg-orange-50 text-orange-900 border-orange-200'
    case 'normal':
      return 'bg-slate-50 text-slate-600 border-slate-200'
    default:
      return 'bg-gray-50 text-gray-600 border-gray-200'
  }
}
