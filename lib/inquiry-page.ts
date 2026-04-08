import type { CustomerInquiryType } from '@/lib/customer-inquiry-intake'

/** URL `?type=` — 단일 페이지에서 4종 분기 */
export const INQUIRY_KINDS = ['travel', 'institution', 'training', 'bus'] as const
export type InquiryKind = (typeof INQUIRY_KINDS)[number]

/** `InquirySuccessPanel`에 넘기는 kind (URL type과 동일) */
export type InquirySuccessKind = InquiryKind

export function normalizeInquiryKind(raw: string | undefined): InquiryKind {
  const u = (raw ?? '').toLowerCase().trim()
  if (u === 'institution' || u === 'training' || u === 'bus' || u === 'travel') return u
  return 'travel'
}

export function inquiryKindToApiType(kind: InquiryKind): CustomerInquiryType {
  switch (kind) {
    case 'travel':
      return 'travel_consult'
    case 'institution':
      return 'institution_request'
    case 'training':
      return 'overseas_training_quote'
    case 'bus':
      return 'bus_quote'
    default: {
      const _x: never = kind
      return _x
    }
  }
}

/** 서버에서 파싱해 클라이언트로 넘기는 쿼리 컨텍스트 */
export type InquiryPageQuery = {
  productId: string | null
  monthlyCurationItemId: string | null
  snapshotProductTitle: string | null
  snapshotCardLabel: string | null
  /** 사전 채움용(희망 월) */
  targetYearMonth: string | null
  /** 국외연수 서비스 범위 프리셋 */
  trainingServiceScope: string | null
}

export function parseInquirySearchParams(
  sp: Record<string, string | string[] | undefined>
): InquiryPageQuery {
  const first = (key: string): string | null => {
    const v = sp[key]
    if (typeof v === 'string') return v.trim() || null
    if (Array.isArray(v) && typeof v[0] === 'string') return v[0].trim() || null
    return null
  }
  const ym = first('targetYearMonth')
  const ymOk = ym && /^\d{4}-\d{2}$/.test(ym) ? ym : null
  return {
    productId: first('productId'),
    monthlyCurationItemId: first('monthlyCurationItemId'),
    snapshotProductTitle: first('snapshotProductTitle'),
    snapshotCardLabel: first('snapshotCardLabel'),
    targetYearMonth: ymOk,
    trainingServiceScope: first('service'),
  }
}

/** 유형별 상단 제목·설명 (상담/접수 톤, 쇼핑몰형 지양) */
export const INQUIRY_UI_META: Record<
  InquiryKind,
  { title: string; description: string }
> = {
  travel: {
    title: '여행 상담·예약 신청',
    description:
      '일정·인원·지역을 남겨 주시면 담당자가 검토 후 연락드립니다. 접수만으로 예약이 확정되지 않으며, 최종 조건은 공급사(여행사) 확인 후 안내됩니다.',
  },
  institution: {
    title: '연수·교류 기관 섭외 문의',
    description:
      '해외 기관 방문·교류·레퍼런스 확인 등 기관 측 섭외가 필요한 경우에 맞춰 접수합니다. 일반 패키지 여행 상담과 성격이 다를 수 있습니다.',
  },
  training: {
    title: '국외연수 문의하기',
    description:
      '기관·학교·단체 목적에 맞는 국외연수 일정을 상담해드립니다. 연수 목적, 인원, 희망 국가와 일정 조건을 남겨주시면 맞춤형으로 검토 후 안내드립니다.',
  },
  bus: {
    title: '전세·단체 버스 견적 문의',
    description:
      '노선·일정·차량 규격에 따라 견적이 달라집니다. 배차·확정 여부는 상담 후 안내됩니다.',
  },
}

/** 유형 탭 전환 시 productId 등 컨텍스트 유지 */
export function buildInquiryHref(kind: InquiryKind, q: InquiryPageQuery): string {
  const p = new URLSearchParams()
  p.set('type', kind)
  if (q.productId) p.set('productId', q.productId)
  if (q.monthlyCurationItemId) p.set('monthlyCurationItemId', q.monthlyCurationItemId)
  if (q.snapshotProductTitle) p.set('snapshotProductTitle', q.snapshotProductTitle)
  if (q.snapshotCardLabel) p.set('snapshotCardLabel', q.snapshotCardLabel)
  if (q.targetYearMonth) p.set('targetYearMonth', q.targetYearMonth)
  if (q.trainingServiceScope) p.set('service', q.trainingServiceScope)
  return `/inquiry?${p.toString()}`
}

export function compactPayloadJson(p: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) {
    if (v === undefined || v === null) continue
    if (typeof v === 'string' && v.trim() === '') continue
    if (typeof v === 'number' && !Number.isFinite(v)) continue
    out[k] = typeof v === 'string' ? v.trim() : v
  }
  return out
}
