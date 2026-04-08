/**
 * 공통 등록 플로우 — 해외/국내 동일 초안 형태 (DB 반영 전).
 * 출발 회차 필드명 SSOT: prisma ProductDeparture = DepartureInput; 미리보기 JSON 행 = DeparturePreviewRow.
 * 어댑터·스크래퍼는 Partial<DepartureInput> 을 채워 DepartureInput[] 로 병합한 뒤 upsert·미리보기에 넘긴다.
 */
import type { DeparturePreviewRow } from '@/lib/departure-preview'

/** 수동 보조 붙여넣기 슬롯 (자동 실패 시 정상 플로우) */
export type ManualAssistSlots = {
  bodyText?: string
  priceTableText?: string
  priceTableHtml?: string
  departureListText?: string
  itineraryBodyText?: string
  transportSnippet?: string
  supplierRawSnippet?: string
}

export type ProductDraft = {
  originSource: string
  originCode: string
  originUrl?: string | null
  title: string
  destinationRaw?: string | null
  primaryDestination?: string | null
  duration?: string | null
  summary?: string | null
  productType?: string | null
  imageStage?: 'IMAGE_PENDING' | 'IMAGE_CANDIDATES_READY' | 'IMAGE_CONFIRMED'
}

export type ItineraryDayDraft = {
  day: number
  rawBlock?: string | null
  summaryTextRaw?: string | null
  city?: string | null
}

export type RegistrationDraftBundle = {
  productDraft: ProductDraft
  /** API 미리보기·검수 화면과 동일 (직렬화된 출발 행) */
  departureDrafts: DeparturePreviewRow[]
  itineraryDayDrafts: ItineraryDayDraft[]
  manual?: ManualAssistSlots
  fieldIssues?: { field: string; reason: string; source: 'auto' | 'manual' }[]
}
