/**
 * 미리보기 변환 — [사실 가져오기] bundle 재사용 (URL·supplier 일치 시에만).
 * REGRESSION-FREEZE[register-facts-fetch-resilience]: prefetchedFactBundle skip live collect — manifest
 */
import type {
  SupplierRegisterFactBundle,
  SupplierRegisterFactSource,
} from '@/lib/register-facts/types'

function normalizeFactOriginUrl(raw: string): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  try {
    const u = new URL(s)
    u.hash = ''
    return u.toString().replace(/\/$/, '').toLowerCase()
  } catch {
    return s.replace(/\/$/, '').toLowerCase()
  }
}

/** body.registerFactBundle이 originUrl(+supplier)과 맞으면 그대로, 아니면 null → live collect. */
export function resolvePrefetchedRegisterFactBundle(
  originUrl: string,
  candidate: unknown,
  expectedSupplier: SupplierRegisterFactSource,
): SupplierRegisterFactBundle | null {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null
  const bundle = candidate as SupplierRegisterFactBundle
  if (bundle.supplier !== expectedSupplier) return null
  const want = normalizeFactOriginUrl(originUrl)
  const got = normalizeFactOriginUrl(String(bundle.originUrl ?? ''))
  if (!want || !got || want !== got) return null
  if (!Array.isArray(bundle.scheduleDays) || !Array.isArray(bundle.priceRows)) return null
  return bundle
}
