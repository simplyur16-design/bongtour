import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

/** 라운드로빈 시 bucket 순회 순서(사전순 사용 안 함) */
export const SUPPLIER_INTERLEAVE_ORDER = [
  'hanatour',
  'modetour',
  'verygoodtour',
  'ybtour',
  'unknown',
] as const

/** 라운드로빈 그룹 키 — `etc`·비라운드로빈 공급사는 `unknown` */
export function getSupplierInterleaveKey(originSource: string | null | undefined): string {
  const k = normalizeSupplierOrigin(originSource)
  const normalized = k === 'etc' ? 'unknown' : k
  if ((SUPPLIER_INTERLEAVE_ORDER as readonly string[]).includes(normalized)) return normalized
  return 'unknown'
}

type WithOrigin = { originSource: string }

/**
 * 동일 카테고리(또는 동일 목록) 안에서 공급사별로 라운드로빈 섞기.
 * - 입력 순서를 공급사 bucket 내부 상대 순서로 유지(안정)
 * - bucket 순회는 `SUPPLIER_INTERLEAVE_ORDER` 고정, 비어 있으면 건너뜀
 * - 랜덤 없음, 상품 1회만, 길이 동일
 */
export function interleaveProductsBySupplier<T extends WithOrigin>(products: readonly T[]): T[] {
  if (products.length <= 1) return products.length === 1 ? [products[0]!] : []

  const buckets = new Map<string, T[]>()
  for (const p of products) {
    const key = getSupplierInterleaveKey(p.originSource)
    let arr = buckets.get(key)
    if (!arr) {
      arr = []
      buckets.set(key, arr)
    }
    arr.push(p)
  }

  const queues: T[][] = []
  for (const key of SUPPLIER_INTERLEAVE_ORDER) {
    const b = buckets.get(key)
    if (b && b.length > 0) queues.push(b.slice())
  }

  const out: T[] = []
  let remaining = products.length
  while (remaining > 0) {
    let progressed = false
    for (const q of queues) {
      if (q.length > 0) {
        const next = q.shift()
        if (next !== undefined) {
          out.push(next)
          remaining--
          progressed = true
        }
      }
    }
    if (!progressed) break
  }
  if (remaining > 0) {
    for (const q of queues) {
      while (q.length > 0) {
        const next = q.shift()
        if (next !== undefined) out.push(next)
      }
    }
  }
  return out
}
