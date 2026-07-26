/**
 * NCP CLOVA OCR Document name-card invoke.
 * REGRESSION-FREEZE[bongsim-affiliation-card-ocr]: Clova name-card OCR — manifest
 */

export type ClovaNameCardOcrFields = {
  name: string | null
  company: string | null
  email: string | null
  phone: string | null
  position: string | null
}

export type ClovaNameCardOcrResult =
  | { ok: true; fields: ClovaNameCardOcrFields; raw: unknown }
  | { ok: false; reason: 'env_missing' | 'http_error' | 'parse_error'; message: string; raw?: unknown }

function firstText(value: unknown): string | null {
  if (typeof value === 'string') {
    const t = value.trim()
    return t || null
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) return item.trim()
      if (item && typeof item === 'object') {
        const o = item as { text?: unknown; formatted?: { value?: unknown } }
        if (typeof o.text === 'string' && o.text.trim()) return o.text.trim()
        if (typeof o.formatted?.value === 'string' && o.formatted.value.trim()) {
          return o.formatted.value.trim()
        }
      }
    }
  }
  if (value && typeof value === 'object') {
    const o = value as { text?: unknown; formatted?: { value?: unknown } }
    if (typeof o.text === 'string' && o.text.trim()) return o.text.trim()
    if (typeof o.formatted?.value === 'string' && o.formatted.value.trim()) {
      return o.formatted.value.trim()
    }
  }
  return null
}

/** CLOVA name-card Document 응답에서 주요 필드 추출 */
export function parseClovaNameCardFields(raw: unknown): ClovaNameCardOcrFields {
  const empty: ClovaNameCardOcrFields = {
    name: null,
    company: null,
    email: null,
    phone: null,
    position: null,
  }
  if (!raw || typeof raw !== 'object') return empty
  const images = (raw as { images?: unknown[] }).images
  if (!Array.isArray(images) || images.length === 0) return empty
  const first = images[0] as {
    nameCard?: { result?: Record<string, unknown> }
    result?: Record<string, unknown>
  }
  const result = first.nameCard?.result ?? first.result
  if (!result || typeof result !== 'object') return empty

  return {
    name: firstText(result.name) ?? firstText(result.names),
    company: firstText(result.company) ?? firstText(result.companies),
    email: firstText(result.email) ?? firstText(result.emails),
    phone:
      firstText(result.mobile) ??
      firstText(result.tel) ??
      firstText(result.phone) ??
      firstText(result.mobiles),
    position: firstText(result.position) ?? firstText(result.department),
  }
}

export function isClovaNameCardOcrConfigured(): boolean {
  return Boolean(
    process.env.NCP_CLOVA_OCR_INVOKE_URL?.trim() && process.env.NCP_CLOVA_OCR_SECRET?.trim(),
  )
}

export async function invokeClovaNameCardOcr(params: {
  imageBase64: string
  format: 'jpg' | 'jpeg' | 'png' | 'webp'
  requestId?: string
}): Promise<ClovaNameCardOcrResult> {
  const invokeUrl = process.env.NCP_CLOVA_OCR_INVOKE_URL?.trim()
  const secret = process.env.NCP_CLOVA_OCR_SECRET?.trim()
  if (!invokeUrl || !secret) {
    return { ok: false, reason: 'env_missing', message: 'NCP_CLOVA_OCR_INVOKE_URL / NCP_CLOVA_OCR_SECRET 미설정' }
  }

  const format = params.format === 'jpeg' ? 'jpg' : params.format
  const body = {
    version: 'V2',
    requestId: params.requestId?.trim() || `affil-${Date.now()}`,
    timestamp: Date.now(),
    images: [
      {
        format,
        name: 'name-card',
        data: params.imageBase64.replace(/^data:image\/\w+;base64,/, ''),
      },
    ],
  }

  let res: Response
  try {
    res = await fetch(invokeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-OCR-SECRET': secret,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    })
  } catch (e) {
    return {
      ok: false,
      reason: 'http_error',
      message: e instanceof Error ? e.message : 'OCR fetch failed',
    }
  }

  const rawText = await res.text()
  let raw: unknown
  try {
    raw = rawText ? JSON.parse(rawText) : null
  } catch {
    return {
      ok: false,
      reason: 'parse_error',
      message: `OCR JSON parse failed (HTTP ${res.status})`,
      raw: rawText.slice(0, 500),
    }
  }

  if (!res.ok) {
    return {
      ok: false,
      reason: 'http_error',
      message: `OCR HTTP ${res.status}`,
      raw,
    }
  }

  return { ok: true, fields: parseClovaNameCardFields(raw), raw }
}
