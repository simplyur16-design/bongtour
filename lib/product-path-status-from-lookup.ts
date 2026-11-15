/**
 * 공개 상품 조회 결과 → middleware 판정(`/api/public/product-path-status`). Node 전용(prisma 모듈 경유 import).
 * REGRESSION-FREEZE[seo-training-products-301]: 국외연수 상품 `/products/<slug>` → `/business/programs/<slug>` 301 — manifest
 */
import type { ProductPathStatus } from '@/lib/product-path-status'
import {
  isOverseasTrainingListingKind,
  type ResolvedProductLookup,
} from '@/lib/resolve-product-by-path-segment'
import { trainingProgramPublicPath } from '@/lib/overseas-training-program-query'

export function productPathStatusFromLookup(r: ResolvedProductLookup): ProductPathStatus {
  if (r.kind === 'not_found') return { kind: 'not_found' }
  if (isOverseasTrainingListingKind(r.listingKind)) {
    if (r.kind === 'redirect') {
      return { kind: 'redirect_path', path: trainingProgramPublicPath({ id: r.slug, slug: r.slug }) }
    }
    return { kind: 'redirect_path', path: trainingProgramPublicPath({ id: r.productId, slug: r.slug }) }
  }
  if (r.kind === 'redirect') return { kind: 'redirect', slug: r.slug }
  return { kind: 'render' }
}
