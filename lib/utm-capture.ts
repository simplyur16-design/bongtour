'use client'

export type UtmQueryFields = {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
}

export type UtmSessionPayload = UtmQueryFields & {
  referrer?: string
  landingPath?: string
}

const UTM_SESSION_KEY = 'bongtour_utm'

function trimUtm(v: string | null): string | undefined {
  const t = (v ?? '').trim()
  return t ? t.slice(0, 500) : undefined
}

/** URL 쿼리에서 utm_* → camelCase. 값이 하나도 없으면 null. */
export function readUtmFromUrl(searchParams: URLSearchParams): UtmQueryFields | null {
  const utmSource = trimUtm(searchParams.get('utm_source'))
  const utmMedium = trimUtm(searchParams.get('utm_medium'))
  const utmCampaign = trimUtm(searchParams.get('utm_campaign'))
  const utmContent = trimUtm(searchParams.get('utm_content'))
  const utmTerm = trimUtm(searchParams.get('utm_term'))
  if (!utmSource && !utmMedium && !utmCampaign && !utmContent && !utmTerm) return null
  const o: UtmQueryFields = {}
  if (utmSource) o.utmSource = utmSource
  if (utmMedium) o.utmMedium = utmMedium
  if (utmCampaign) o.utmCampaign = utmCampaign
  if (utmContent) o.utmContent = utmContent
  if (utmTerm) o.utmTerm = utmTerm
  return o
}

/** sessionStorage `bongtour_utm` 이 없을 때만 저장 (덮어쓰기 없음). */
export function persistUtmToSession(utm: UtmSessionPayload): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(UTM_SESSION_KEY)) return
    sessionStorage.setItem(UTM_SESSION_KEY, JSON.stringify(utm))
  } catch {
    /* ignore quota / private mode */
  }
}

export function readUtmFromSession(): UtmSessionPayload {
  if (typeof window === 'undefined') return {}
  try {
    const raw = sessionStorage.getItem(UTM_SESSION_KEY)
    if (!raw) return {}
    const o = JSON.parse(raw) as Record<string, unknown>
    const out: UtmSessionPayload = {}
    const pick = (k: keyof UtmSessionPayload) => {
      const v = o[k]
      if (typeof v === 'string' && v.trim()) (out as Record<string, string>)[k] = v.trim().slice(0, 2000)
    }
    pick('utmSource')
    pick('utmMedium')
    pick('utmCampaign')
    pick('utmContent')
    pick('utmTerm')
    pick('referrer')
    pick('landingPath')
    return out
  } catch {
    return {}
  }
}
