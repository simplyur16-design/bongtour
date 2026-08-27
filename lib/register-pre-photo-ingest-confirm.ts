/**
 * 등록 파이프(parse-and-register preview→confirm) — 사진 수급 없음.
 * confirm 직후 검증. 통과한 것만 등록대기(pending). 실패는 pre_photo_blocked.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ingestLane travelScope · lane_mismatch — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: confirm 후 검증 게이트 — manifest
 */
import { getAdminServiceBearerSecret } from '@/lib/admin-secrets'
import { getSiteOrigin } from '@/lib/site-metadata'
import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'
import { resolveRegisterTravelScopeFromRequest } from '@/lib/register-admin-travel-category'
import { parseRegisterFactProductKind } from '@/lib/register-facts/product-kind'
import {
  factKindMatchesIngestLane,
  travelScopeForIngestLane,
  type RegisterPrePhotoIngestLane,
} from '@/lib/register-pre-photo-ingest-geo-slots'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { healPendingRegisterPrePhoto } from '@/lib/register-pending-pre-photo-self-heal'

const REGISTER_ROUTE: Record<CanonicalOverseasSupplierKey, string | null> = {
  hanatour: '/api/travel/parse-and-register-hanatour',
  modetour: '/api/travel/parse-and-register-modetour',
  ybtour: '/api/travel/parse-and-register-ybtour',
  verygoodtour: '/api/travel/parse-and-register-verygoodtour',
  lottetour: null,
  kyowontour: null,
  naeiltour: null,
}

export type IngestConfirmResult = {
  ok: boolean
  productId?: string
  reason?: string
}

export async function confirmRegisterPendingFromOriginUrl(args: {
  supplier: CanonicalOverseasSupplierKey
  originUrl: string
  dryRun?: boolean
  ingestLane?: RegisterPrePhotoIngestLane
}): Promise<IngestConfirmResult> {
  const route = REGISTER_ROUTE[args.supplier]
  if (!route) return { ok: false, reason: 'supplier_route_unsupported' }
  const originUrl = args.originUrl.trim()
  if (!originUrl) return { ok: false, reason: 'originUrl_empty' }

  const travelScope = args.ingestLane
    ? travelScopeForIngestLane(args.ingestLane)
    : resolveRegisterTravelScopeFromRequest({
        bodyTravelScope: '',
        originSource: args.supplier,
        originUrl,
      })

  const bundle = await collectSupplierRegisterFacts(args.supplier, originUrl)
  if (args.ingestLane && bundle && !factKindMatchesIngestLane(parseRegisterFactProductKind(bundle), args.ingestLane)) {
    return { ok: false, reason: 'lane_mismatch' }
  }
  const text = bundle
    ? registerFactBundleToPasteText(bundle)
    : [`출처 URL: ${originUrl}`, `공급사: ${args.supplier}`].join('\n')

  if (args.dryRun) {
    return { ok: Boolean(bundle), reason: bundle ? 'dry_run' : 'facts_missing_dry_run' }
  }

  const bearer = getAdminServiceBearerSecret()
  if (!bearer) return { ok: false, reason: 'admin_bearer_unconfigured' }

  const previewBody = {
    mode: 'preview' as const,
    brandKey: args.supplier,
    originSource: args.supplier,
    originUrl,
    travelScope,
    text,
  }

  const preview = await postRegisterJson(route, previewBody, bearer)
  if (!preview.json.success || !preview.json.previewToken) {
    return { ok: false, reason: preview.json.error ?? 'preview_failed' }
  }

  const confirm = await postRegisterJson(
    route,
    {
      ...previewBody,
      mode: 'confirm',
      previewToken: preview.json.previewToken,
      previewContentDigest: preview.json.previewContentDigest,
      parsed: preview.json.parsed,
      ...(bundle?.flights?.length ? { registerFactFlights: bundle.flights } : {}),
    },
    bearer,
  )
  if (!confirm.json.success || !confirm.json.productId) {
    return { ok: false, reason: confirm.json.error ?? 'confirm_failed' }
  }
  const productId = confirm.json.productId
  const gate = await healPendingRegisterPrePhoto({ limit: 1, productId, dryRun: false })
  if (gate.verifyFailed > 0 || gate.verified < 1) {
    return { ok: false, reason: 'pre_photo_verify_failed', productId }
  }
  return { ok: true, productId }
}

async function postRegisterJson(
  path: string,
  body: unknown,
  bearer: string,
): Promise<{
  status: number
  json: {
    success?: boolean
    previewToken?: string
    previewContentDigest?: string
    parsed?: unknown
    productId?: string
    error?: string
  }
}> {
  const res = await fetch(`${getSiteOrigin()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  })
  const json = (await res.json()) as {
    success?: boolean
    previewToken?: string
    previewContentDigest?: string
    parsed?: unknown
    productId?: string
    error?: string
  }
  return { status: res.status, json }
}
