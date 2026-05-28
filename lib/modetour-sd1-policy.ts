/** modetour b2c-api SD1(단종) 연속 응답 → 은퇴 임계. modetour sales-policy 전용. */
export const MODETOUR_SD1_RETIRE_STREAK = 3

export const MODETOUR_SD1_AUTO_UNPUBLISH_REASON = 'modetour_sd1'

/**
 * 실측 400 body (productNo=101580840):
 * `{ "errorMessages":[{"errorCode":"상품이 존재하지 않습니다. [SD1]","errorMessage":"..."}],"isOK":false }`
 * — errorCode 키 값은 리터럴 `'SD1'`이 아니라 문구 끝 `[SD1]` 포함.
 */
export type ModetourB2cErrorMessage = {
  errorCode?: string
  errorMessage?: string
}

export class ModetourB2cApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly bodyText: string,
    readonly bodyJson: unknown
  ) {
    super(`modetour api failed: HTTP ${status} (${url}) body=${bodyText.slice(0, 500)}`)
    this.name = 'ModetourB2cApiError'
  }
}

function modetourErrorEntryIsSd1(entry: unknown): boolean {
  if (typeof entry === 'string') {
    return entry === 'SD1' || entry.includes('[SD1]')
  }
  if (!entry || typeof entry !== 'object') return false
  const o = entry as ModetourB2cErrorMessage
  const code = String(o.errorCode ?? '')
  const msg = String(o.errorMessage ?? '')
  if (code === 'SD1' || msg === 'SD1') return true
  if (code.includes('[SD1]') || msg.includes('[SD1]')) return true
  return false
}

/** 400 + errorMessages[] SD1 (exact code 우선, `[SD1]` substring 폴백). */
export function modetourB2cBodyIndicatesSd1(bodyJson: unknown, bodyText: string): boolean {
  if (bodyJson && typeof bodyJson === 'object') {
    const msgs = (bodyJson as { errorMessages?: unknown }).errorMessages
    if (Array.isArray(msgs) && msgs.some(modetourErrorEntryIsSd1)) return true
  }
  return bodyText.includes('[SD1]')
}

export function isModetourSd1NotFoundError(err: unknown): err is ModetourB2cApiError {
  if (!(err instanceof ModetourB2cApiError)) return false
  if (err.status !== 400) return false
  return modetourB2cBodyIndicatesSd1(err.bodyJson, err.bodyText)
}
