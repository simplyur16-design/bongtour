/** [hanatour] register-admin-input-digest — preview↔confirm 입력 지문 */
import { createHash } from 'crypto'
import { buildRegisterPreviewCanonicalString } from '@/lib/register-preview-content-fingerprint-hanatour'
import {
  normalizeHanatourRegisterOriginUrl,
  parseHanatourRegisterPastedBlocksFromBody,
} from '@/lib/register-admin-core-hanatour'

/** @deprecated 이름 호환 — `parseHanatourRegisterPastedBlocksFromBody` */
export const parseRegisterPastedBlocksPayload = parseHanatourRegisterPastedBlocksFromBody

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
  const originUrlRaw = typeof body.originUrl === 'string' ? body.originUrl.trim() : null
  const originUrl = originUrlRaw && originUrlRaw !== '' ? normalizeHanatourRegisterOriginUrl(originUrlRaw) : null
  const travelScope = typeof body.travelScope === 'string' ? body.travelScope.trim() : ''
  const pb = parseHanatourRegisterPastedBlocksFromBody(body)
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
