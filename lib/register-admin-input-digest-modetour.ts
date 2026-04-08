/** [modetour] register-admin-input-digest */
import { createHash } from 'crypto'
import { buildRegisterPreviewCanonicalString } from '@/lib/register-preview-content-fingerprint-modetour'
import type { RegisterPastedBlocksInput } from '@/lib/register-llm-blocks-modetour'

/** 핸들러의 parsePastedBlocksFromBody와 동일 키만 digest에 반영 */
export function parseRegisterPastedBlocksPayload(
  body: Record<string, unknown>
): Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping' | 'hotel' | 'airlineTransport'>> | null {
  const b = body.pastedBlocks
  if (!b || typeof b !== 'object' || Array.isArray(b)) return null
  const o = b as Record<string, unknown>
  const pick = (key: string) => {
    const v = o[key]
    return typeof v === 'string' && v.trim() ? v.trim().slice(0, 32000) : undefined
  }
  const out: Partial<Pick<RegisterPastedBlocksInput, 'optionalTour' | 'shopping' | 'hotel' | 'airlineTransport'>> = {}
  const ot = pick('optionalTour')
  if (ot) out.optionalTour = ot
  const sh = pick('shopping')
  if (sh) out.shopping = sh
  const ho = pick('hotel')
  if (ho) out.hotel = ho
  const air = pick('airlineTransport')
  if (air) out.airlineTransport = air
  return Object.keys(out).length > 0 ? out : null
}

export function computeRegisterInputDigestFromBody(
  body: Record<string, unknown>,
  forcedBrandKey: string | null | undefined
): string {
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  const brandKey =
    forcedBrandKey != null && forcedBrandKey !== ''
      ? forcedBrandKey
      : typeof body.brandKey === 'string'
        ? body.brandKey.trim() || null
        : null
  let originUrl: string | null = typeof body.originUrl === 'string' ? body.originUrl.trim() : null
  if (originUrl === '') originUrl = null
  if (originUrl && originUrl.length > 2000) originUrl = originUrl.slice(0, 2000)
  const travelScope = typeof body.travelScope === 'string' ? body.travelScope.trim() : ''
  const pb = parseRegisterPastedBlocksPayload(body)
  const pastedBlocksForFp = pb
    ? {
        airlineTransport: pb.airlineTransport ?? undefined,
        hotel: pb.hotel ?? undefined,
        optionalTour: pb.optionalTour ?? undefined,
        shopping: pb.shopping ?? undefined,
      }
    : undefined
  const canonical = buildRegisterPreviewCanonicalString({
    text,
    brandKey,
    originUrl,
    travelScope,
    pastedBlocks: pastedBlocksForFp,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('base64url')
}
