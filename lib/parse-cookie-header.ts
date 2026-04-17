/**
 * Route Handler 에서 `cookies()` 와 불일치할 때를 대비해 `Cookie` 헤더 직접 파싱.
 */
export function readCookieFromRequestHeader(request: Request, name: string): string | undefined {
  const raw = request.headers.get('cookie')
  if (!raw) return undefined
  for (const segment of raw.split(';')) {
    const part = segment.trim()
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const k = part.slice(0, eq).trim()
    if (k !== name) continue
    try {
      return decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      return part.slice(eq + 1).trim()
    }
  }
  return undefined
}
