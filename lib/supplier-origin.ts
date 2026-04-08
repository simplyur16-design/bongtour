/**
 * 공급사 식별/정규화 유틸.
 * Product 식별키(originSource + originCode)를 공급사별로 일관되게 유지한다.
 */

import { normalizeSupplierOrigin, OVERSEAS_SUPPLIER_LABEL } from '@/lib/normalize-supplier-origin'

export const VERYGOODTOUR_SOURCE = 'VERYGOODTOUR'

/**
 * DB·복합키는 `modetour`·`VERYGOODTOUR` 등 내부 식별자를 유지하고,
 * 화면·고객 메시지에는 `OVERSEAS_SUPPLIER_LABEL` 기준 한글 상호로 표시한다.
 */
export function formatOriginSourceForDisplay(source: string | null | undefined): string {
  const s = (source ?? '').trim()
  if (!s) return ''
  const key = normalizeSupplierOrigin(s)
  if (key !== 'etc') return OVERSEAS_SUPPLIER_LABEL[key]
  return s
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * 참좋은여행은 내부 식별 originSource를 VERYGOODTOUR로 통일한다.
 * (표시명은 UI/브랜드 레이어에서 별도 처리)
 */
export function normalizeOriginSource(input: string | null | undefined, brandKey?: string | null): string {
  const src = norm(input)
  const bk = norm(brandKey)
  if (bk === 'verygoodtour' || src.includes('참좋은') || src.includes('verygoodtour') || src === 'verygoodtour') {
    return VERYGOODTOUR_SOURCE
  }
  return (input ?? '').trim() || '직접입력'
}

/**
 * VERYGOODTOUR URL에서 ProCode 추출.
 * 예: ...PackageDetail?ProCode=JPP423-260329TW&PriceSeq=1
 */
export function extractVerygoodProCode(originUrl: string | null | undefined): string | null {
  if (!originUrl?.trim()) return null
  try {
    const u = new URL(originUrl.trim())
    const proCode = u.searchParams.get('ProCode')?.trim() || u.searchParams.get('proCode')?.trim() || ''
    return proCode || null
  } catch {
    return null
  }
}

/**
 * 참좋은여행 "상품번호"를 supplierGroupId로 사용.
 * 예: "상품번호 JPP423"
 */
export function extractVerygoodSupplierGroupId(text: string | null | undefined): string | null {
  if (!text?.trim()) return null
  const m = text.match(/상품번호\s*[:：]?\s*([A-Z]{2,}\d{2,})/i)
  if (m?.[1]) return m[1].trim().toUpperCase()
  return null
}
