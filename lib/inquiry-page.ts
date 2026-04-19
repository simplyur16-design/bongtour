import type { CustomerInquiryType } from '@/lib/customer-inquiry-intake'

/**
 * URL `?type=` ↔ POST `inquiryType` SSOT (4종만).
 * - travel → travel_consult
 * - institution → institution_request
 * - training → overseas_training_quote
 * - bus → bus_quote
 */
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
  const snapshotProductTitle = first('snapshotProductTitle') ?? first('productHint')
  return {
    productId: first('productId'),
    monthlyCurationItemId: first('monthlyCurationItemId'),
    snapshotProductTitle,
    snapshotCardLabel: first('snapshotCardLabel'),
    targetYearMonth: ymOk,
    trainingServiceScope: first('service'),
  }
}

/** 비여행 문의로 전환 시 상품·큐레이션 딥링크가 URL에 남지 않도록 제거 */
export function sanitizeInquiryQueryForKind(kind: InquiryKind, q: InquiryPageQuery): InquiryPageQuery {
  if (kind === 'travel') return { ...q }
  return {
    ...q,
    productId: null,
    monthlyCurationItemId: null,
    snapshotProductTitle: null,
    snapshotCardLabel: null,
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
      '필수 항목만으로도 접수 가능합니다. 담당자가 확인 후 상담으로 일정·조건을 함께 정리해 드립니다. 접수만으로 예약·확정이 되지는 않습니다.',
  },
  bus: {
    title: '전세·단체 버스 문의',
    description:
      '예상 인원만으로도 접수할 수 있습니다. 전세버스는 왕복 기준이며, 노선·일정·차량은 상담하면서 맞춰 드립니다. 접수만으로 배차 확정이 되지는 않습니다.',
  },
}

/** 유형 탭 전환 — `travel`일 때만 상품·큐레이션 쿼리 유지 */
export function buildInquiryHref(kind: InquiryKind, q: InquiryPageQuery): string {
  const safe = sanitizeInquiryQueryForKind(kind, q)
  const p = new URLSearchParams()
  p.set('type', kind)
  if (kind === 'travel') {
    if (safe.productId) p.set('productId', safe.productId)
    if (safe.monthlyCurationItemId) p.set('monthlyCurationItemId', safe.monthlyCurationItemId)
    if (safe.snapshotProductTitle) p.set('snapshotProductTitle', safe.snapshotProductTitle)
    if (safe.snapshotCardLabel) p.set('snapshotCardLabel', safe.snapshotCardLabel)
  }
  if (kind === 'training') {
    if (safe.targetYearMonth) p.set('targetYearMonth', safe.targetYearMonth)
    if (safe.trainingServiceScope) p.set('service', safe.trainingServiceScope)
  } else if (safe.targetYearMonth && (kind === 'travel' || kind === 'institution' || kind === 'bus')) {
    p.set('targetYearMonth', safe.targetYearMonth)
  }
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
