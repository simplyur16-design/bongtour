import { unstable_cache } from 'next/cache'
import { computeMegaMenuLiveCounts } from '@/lib/mega-menu-live-counts'
import { jsonWithLeakGuard } from '@/lib/public-response-guard'

/**
 * GET /api/mega-menu/counts — 메가메뉴 링크별 공개 상품 수(1시간 캐시).
 * 사장님 2026-11-22 00:50 메뉴 자동 정리. 실패하면 counts:null → 화면은 원래 메뉴 그대로.
 * REGRESSION-FREEZE[mega-menu-live-auto-1122]: 1시간 캐시 수 API — manifest
 */
const getCounts = unstable_cache(() => computeMegaMenuLiveCounts(), ['mega-menu-live-counts-v1'], {
  revalidate: 3600,
  tags: ['products-browse'],
})

export async function GET() {
  try {
    const payload = await getCounts()
    const res = jsonWithLeakGuard(payload, 'api.mega-menu.counts.ok')
    res.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600')
    return res
  } catch (e) {
    console.error('[GET /api/mega-menu/counts]', e instanceof Error ? e.name : 'Error')
    return jsonWithLeakGuard({ at: null, counts: null, failed: -1 }, 'api.mega-menu.counts.fail')
  }
}
