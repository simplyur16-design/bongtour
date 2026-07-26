/**
 * Prisma query engine rejects strings with lone UTF-16 surrogates (truncated emoji etc.).
 * @see https://github.com/prisma/prisma/issues/21578
 * REGRESSION-FREEZE[register-confirm-prisma-safe-surrogates]: strip before product.create — manifest
 */

/** 고립 서로게이트(이모지 절반 등) 제거 — Prisma create/update 전 필수 */
export function stripLoneUtf16Surrogates(value: string): string {
  let out = ''
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i]! + value[i + 1]!
        i++
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      continue
    } else {
      out += value[i]!
    }
  }
  return out
}

/** 코드포인트 단위 자르기 — `.slice`로 이모지가 반토막 나는 것 방지 */
export function truncatePrismaSafeString(value: string, maxLength: number): string {
  if (maxLength <= 0) return ''
  const cleaned = stripLoneUtf16Surrogates(value)
  const chars = Array.from(cleaned)
  if (chars.length <= maxLength) return cleaned
  return chars.slice(0, maxLength).join('')
}

export function sanitizePrismaWriteData<T>(data: T): T {
  if (data === null || data === undefined) return data
  if (typeof data === 'string') return stripLoneUtf16Surrogates(data) as T
  if (typeof data === 'bigint' || typeof data === 'number' || typeof data === 'boolean') return data
  if (data instanceof Date) return data
  if (Array.isArray(data)) return data.map((item) => sanitizePrismaWriteData(item)) as T
  if (typeof data === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      out[key] = sanitizePrismaWriteData(val)
    }
    return out as T
  }
  return data
}
