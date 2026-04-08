/** CMS 수동 이미지·콘텐츠 출처 한 줄 + 안전한 http(s) URL (순환 import 방지용 공용) */

export function toSafeHttpUrl(v: string | null | undefined): string | null {
  const raw = (v ?? '').trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

export function formatCmsSourceLine(
  sourceName: string | null | undefined,
  sourceUrl: string | null | undefined,
  sourceType: string | null | undefined
): string | null {
  const name = (sourceName ?? '').trim()
  const url = toSafeHttpUrl(sourceUrl ?? undefined)
  const type = (sourceType ?? '').trim()
  if (!name && !url && !type) return null
  const parts: string[] = []
  if (type) parts.push(type)
  if (name) parts.push(name)
  let line = parts.length ? `출처: ${parts.join(' · ')}` : ''
  if (url && name) {
    line = `${line}`.trim()
    return line
  }
  if (url && !name) line = `출처: ${url}`
  return line || null
}
