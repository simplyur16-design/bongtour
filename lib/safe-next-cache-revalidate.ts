import { revalidatePath, revalidateTag } from 'next/cache'

/** instrumentation cron·node-cron 등 Next 요청 밖에서는 revalidateTag가 invariant throw — 무시하고 DB 갱신만 유지 */
export function safeRevalidateTag(tag: string, logPrefix = 'next-cache'): boolean {
  try {
    revalidateTag(tag)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn(`[${logPrefix}] skip revalidateTag (not in Next.js request context)`, tag)
      return false
    }
    throw err
  }
}

/** REGRESSION-FREEZE[product-detail-payload-cron-revalidate-safe]: 스크립트 ingest도 revalidatePath invariant 무시 — manifest */
export function safeRevalidatePath(path: string, logPrefix = 'next-cache'): boolean {
  try {
    revalidatePath(path)
    return true
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('static generation store missing')) {
      console.warn(`[${logPrefix}] skip revalidatePath (not in Next.js request context)`, path)
      return false
    }
    throw err
  }
}

export function safeRevalidateProductDetailTags(productId?: string | null): void {
  const id = String(productId ?? '').trim()
  if (id) safeRevalidateTag(`product-detail-${id}`, 'product-detail-cache')
  safeRevalidateTag('product-detail', 'product-detail-cache')
}
