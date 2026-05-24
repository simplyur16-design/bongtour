import { resolveProductByPathSegmentCached } from '@/lib/product-detail-page-cache'
import { requireAdmin } from '@/lib/require-admin'
import type { ResolvedProductLookup } from '@/lib/resolve-product-by-path-segment'

export type ProductPageAccess = {
  resolved: ResolvedProductLookup
  allowAdminDraft: boolean
}

/** 공개 조회 우선 — draft·미리보기는 관리자 세션 확인 후에만 */
export async function resolveProductPageAccess(rawSegment: string): Promise<ProductPageAccess> {
  const publicResolved = await resolveProductByPathSegmentCached(rawSegment, false)
  if (publicResolved.kind !== 'not_found') {
    return { resolved: publicResolved, allowAdminDraft: false }
  }
  const admin = await requireAdmin()
  if (!admin) {
    return { resolved: publicResolved, allowAdminDraft: false }
  }
  const draftResolved = await resolveProductByPathSegmentCached(rawSegment, true)
  return { resolved: draftResolved, allowAdminDraft: true }
}
