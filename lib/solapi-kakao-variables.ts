/**
 * 솔라피 카카오 알림톡 variables — API 키는 반드시 `#{변수명}` 문자열 형태.
 * @see https://solapi.com/developers/api/messages-ata
 */

export function normalizeSolapiKakaoVariables(variables: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [rawKey, rawVal] of Object.entries(variables)) {
    const bare = rawKey.replace(/^#\{|\}$/g, '').trim()
    if (!bare) continue
    out[`#{${bare}}`] = String(rawVal ?? '')
  }
  return out
}

export function formatSolapiSendError(e: unknown): string {
  if (!(e && typeof e === 'object')) return String(e)
  const o = e as Record<string, unknown>
  const parts: string[] = []
  const msg = o.message ?? o.statusMessage
  if (typeof msg === 'string' && msg.trim()) parts.push(msg.trim())
  const failed = o.failedMessageList ?? o.failedMessages
  if (Array.isArray(failed) && failed.length > 0) {
    parts.push(
      `failedMessageList=${JSON.stringify(failed).slice(0, 1200)}`,
    )
  }
  return parts.length ? parts.join(' | ') : JSON.stringify(o).slice(0, 800)
}
