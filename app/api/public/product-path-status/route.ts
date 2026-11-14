import { NextResponse } from 'next/server'
import { productRowExistsForPathSegment, resolveProductByPathSegment } from '@/lib/resolve-product-by-path-segment'
import { productPathStatusFromLookup } from '@/lib/product-path-status-from-lookup'
import type { ProductPathStatus } from '@/lib/product-path-status'

/**
 * middleware 전용 공개 상품 URL 판정 — 공개(registered + 노출 정책) 조회만. draft 판정 없음.
 * 응답: { kind: 'render' } | { kind: 'redirect', slug } | { kind: 'redirect_path', path } | { kind: 'not_found' }
 * REGRESSION-FREEZE[seo-training-products-301]: 국외연수 상품은 `/business/programs/<slug>` 로 301 — manifest
 * 짧은 프로세스 메모리 캐시(60초) — 같은 URL 연속 요청 DB 부하 방지.
 */
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TTL_MS = 60_000
const MAX_ENTRIES = 3000
const memo = new Map<string, { at: number; value: ProductPathStatus }>()

function remember(seg: string, value: ProductPathStatus) {
  if (memo.size >= MAX_ENTRIES) {
    const first = memo.keys().next().value
    if (first !== undefined) memo.delete(first)
  }
  memo.set(seg, { at: Date.now(), value })
}

export async function GET(req: Request) {
  const seg = (new URL(req.url).searchParams.get('seg') ?? '').trim()
  if (!seg || seg.length > 200) {
    return NextResponse.json({ kind: 'not_found' } satisfies ProductPathStatus)
  }
  const hit = memo.get(seg)
  if (hit && Date.now() - hit.at < TTL_MS) {
    return NextResponse.json(hit.value, { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const r = await resolveProductByPathSegment(seg, { allowAdminDraft: false })
    let value: ProductPathStatus = productPathStatusFromLookup(r)
    // REGRESSION-FREEZE[seo-deleted-product-410]: 공개 조회에 안 잡혀도 행이 남아 있으면(비공개·출발 종료) 404 유지, 행이 없을 때만 410 — manifest
    if (value.kind === 'not_found' && !(await productRowExistsForPathSegment(seg))) {
      value = { kind: 'gone' }
    }
    remember(seg, value)
    return NextResponse.json(value, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[product-path-status] lookup failed', e)
    return NextResponse.json({ error: 'lookup_failed' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
