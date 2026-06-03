/** `BONGTOUR_PERF_LOG=1` — 상세 RSC 단계별 스냅샷 (요청당 1회 consume) */

export type ProductDetailSelectKind = 'slim' | 'full' | 'draft'

export type ProductDetailPerfSnapshot = {
  selectKind: ProductDetailSelectKind
  parseMs: number | null
  payloadBytes: number | null
  payloadSource: 'payload' | 'computed' | null
  viewMs: number | null
}

let snapshot: Partial<ProductDetailPerfSnapshot> | null = null

export function resetProductDetailPerf(): void {
  snapshot = null
}

export function patchProductDetailPerf(patch: Partial<ProductDetailPerfSnapshot>): void {
  snapshot = { ...snapshot, ...patch }
}

export function consumeProductDetailPerf(): ProductDetailPerfSnapshot | null {
  if (!snapshot) return null
  const out: ProductDetailPerfSnapshot = {
    selectKind: snapshot.selectKind ?? 'full',
    parseMs: snapshot.parseMs ?? null,
    payloadBytes: snapshot.payloadBytes ?? null,
    payloadSource: snapshot.payloadSource ?? null,
    viewMs: snapshot.viewMs ?? null,
  }
  snapshot = null
  return out
}

export function isProductDetailPerfLogEnabled(): boolean {
  return process.env.BONGTOUR_PERF_LOG === '1'
}
