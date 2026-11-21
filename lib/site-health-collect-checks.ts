/**
 * 매시 점검 — 수집 항목(사장님 2026-11-22 00:46 PM-24).
 * 공개 상품 중 국내 목적지·분류 없음은 자동으로 못 고치는 문제라 기록만 한다(kind 'code').
 * REGRESSION-FREEZE[ingest-domestic-skip-category-1122]: 매시 점검에 국내 공개·분류 없음 기록 — manifest
 */
import type { HealthCheck, HealthFinding } from '@/lib/site-health-registry'
import { isRegisterIngestDomesticKoreaProduct } from '@/lib/register-ingest-reject-domestic-korea'

export type CollectHealthProduct = {
  id: string
  originSource: string | null
  title: string | null
  destination: string | null
  countryKey: string | null
  travelScope: string | null
}

export type CollectHealthCtx = { products: CollectHealthProduct[] }

function f(checkId: string, p: CollectHealthProduct, detail: string): HealthFinding {
  return { checkId, target: p.id, productId: p.id, detail: `${p.originSource ?? '-'} ${detail}`.slice(0, 160) }
}

export const COLLECT_HEALTH_CHECKS: ReadonlyArray<HealthCheck<CollectHealthCtx>> = [
  {
    id: 'collect-public-domestic',
    area: 'collect',
    kind: 'code',
    summary: '공개 상품 중 국내 목적지(수집 제외 대상)',
    find: (ctx) =>
      ctx.products
        .filter(
          (p) =>
            String(p.travelScope ?? '').toLowerCase() === 'domestic' ||
            isRegisterIngestDomesticKoreaProduct(p.title, p.destination, p.countryKey),
        )
        .map((p) => f('collect-public-domestic', p, 'domestic')),
  },
  {
    id: 'collect-no-category',
    area: 'collect',
    kind: 'code',
    summary: '공개 상품 중 분류(travelScope) 없음',
    find: (ctx) => ctx.products.filter((p) => !String(p.travelScope ?? '').trim()).map((p) => f('collect-no-category', p, 'no travelScope')),
  },
]
