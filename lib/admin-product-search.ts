import { extractProductPathIdentifier } from '@/lib/product-public-path'

/** 어드민 상품 목록 통합 검색어 — URL·slug·cuid·코드 공통 추출 */
export function normalizeAdminProductSearchTerm(raw: string | null | undefined): string {
  return extractProductPathIdentifier(String(raw ?? '').trim())
}
