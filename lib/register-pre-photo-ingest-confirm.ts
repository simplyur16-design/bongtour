/**
 * 등록 파이프(parse-and-register preview→confirm) — 사진 수급 없음.
 * 워커는 HTTP/베어러 없이 기존 등록 핸들러를 같은 프로세스에서 돌린다.
 * 날짜별 가격 B2C(sweep·price-collect)는 여기서 건드리지 않는다.
 * confirm 직후 검증. 통과한 것만 등록대기(pending). 실패는 pre_photo_blocked.
 * REGRESSION-FREEZE[register-pre-photo-listing-ingest]: ingestLane travelScope · lane_mismatch — manifest
 * REGRESSION-FREEZE[register-pre-photo-pending-verify-gate]: 검증 실패는 pending 아님 — manifest
 * REGRESSION-FREEZE[register-pre-photo-dashboard-queue-origin-lane]: ingest origin 공개 URL — manifest
 * REGRESSION-FREEZE[register-listing-discover-human-pace]: in-process register · skipRequireAdmin — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-all-canonical-suppliers]: canonical 7사 in-process confirm — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-pkg-fit-theme-kind]: 팩트 kind·테마 태그 — manifest
 * REGRESSION-FREEZE[register-pre-photo-ingest-naeiltour-fit-first]: 내일투어 자유여행 우선 저장 — manifest
 * REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]: 판매불가·팩트없음은 confirm 안 함 — manifest
 */
import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'
import { resolveRegisterTravelScopeFromRequest } from '@/lib/register-admin-travel-category'
import { inferSportsThemeTagsFromListingHaystack } from '@/lib/product-listing-kind'
import { parseRegisterFactProductKind } from '@/lib/register-facts/product-kind'
import {
  factKindMatchesIngestLane,
  travelScopeForIngestLane,
  type RegisterPrePhotoIngestLane,
} from '@/lib/register-pre-photo-ingest-geo-slots'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { healPendingRegisterPrePhoto } from '@/lib/register-pending-pre-photo-self-heal'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'
import { prisma } from '@/lib/prisma'
import { handleParseAndRegisterHanatourRequest } from '@/lib/parse-and-register-hanatour-handler'
import { handleParseAndRegisterModetourRequest } from '@/lib/parse-and-register-modetour-handler'
import { handleParseAndRegisterYbtourRequest } from '@/lib/parse-and-register-ybtour-handler'
import { handleParseAndRegisterVerygoodtourRequest } from '@/lib/parse-and-register-verygoodtour-handler'
import { handleParseAndRegisterKyowontourRequest } from '@/lib/parse-and-register-kyowontour-handler'
import { handleParseAndRegisterLottetourRequest } from '@/lib/parse-and-register-lottetour-handler'
import { handleParseAndRegisterNaeiltourRequest } from '@/lib/parse-and-register-naeiltour-handler'

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
  themeHintKeys?: readonly string[] | null
}): Promise<IngestConfirmResult> {
  const originUrl = args.originUrl.trim()
  if (!originUrl) return { ok: false, reason: 'originUrl_empty' }

  let productId: string | undefined
  try {
    const bundle = await collectSupplierRegisterFacts(args.supplier, originUrl)
    const factKind = bundle ? parseRegisterFactProductKind(bundle) : null
    // 슬롯은 어떤 메뉴를 눌렀는지, 저장 kind는 상품 팩트. 내일투어처럼 목록에 자유여행이 섞이면 슬롯만 보면 패키지로 굳는다.
    // REGRESSION-FREEZE[register-pre-photo-ingest-pkg-fit-theme-kind]: 팩트 kind로 travelScope — manifest
    const travelScope =
      args.supplier === 'naeiltour' &&
      (args.ingestLane === 'air_hotel_free' || factKind === 'air_hotel_free')
        ? 'air_hotel_free'
        : factKind === 'air_hotel_free'
          ? 'air_hotel_free'
          : args.ingestLane
            ? travelScopeForIngestLane(args.ingestLane)
            : resolveRegisterTravelScopeFromRequest({
                bodyTravelScope: '',
                originSource: args.supplier,
                originUrl,
              })
    if (
      args.ingestLane &&
      factKind &&
      !factKindMatchesIngestLane(factKind, args.ingestLane)
    ) {
      console.error('[register-pre-photo-ingest-confirm] reclassify', args.supplier, factKind, originUrl)
    }
    // REGRESSION-FREEZE[register-pre-photo-naeiltour-unsellable-no-stub]: 판매종료·빈 본문은 stub 금지 — manifest
    if (args.supplier === 'naeiltour' && !bundle) {
      return { ok: false, reason: 'origin_unsellable' }
    }
    const text = bundle
      ? registerFactBundleToPasteText(bundle)
      : [`출처 URL: ${originUrl}`, `공급사: ${args.supplier}`].join('\n')
    const sportsThemeTag = inferSportsThemeTagsFromListingHaystack(
      bundle?.title ?? text,
      args.themeHintKeys,
    )

    if (args.dryRun) {
      return { ok: Boolean(bundle), reason: bundle ? 'dry_run' : 'facts_missing_dry_run' }
    }

    const previewBody = {
      mode: 'preview' as const,
      brandKey: args.supplier,
      originSource: args.supplier,
      originUrl,
      travelScope,
      sportsThemeTag,
      text,
    }

    const preview = await postRegisterInProcess(args.supplier, previewBody)
    if (!preview.json.success || !preview.json.previewToken) {
      return { ok: false, reason: preview.json.error ?? 'preview_failed' }
    }

    const confirm = await postRegisterInProcess(args.supplier, {
      ...previewBody,
      mode: 'confirm',
      previewToken: preview.json.previewToken,
      previewContentDigest: preview.json.previewContentDigest,
      parsed: preview.json.parsed,
      ...(bundle?.flights?.length ? { registerFactFlights: bundle.flights } : {}),
    })
    if (!confirm.json.success || !confirm.json.productId) {
      return { ok: false, reason: confirm.json.error ?? 'confirm_failed' }
    }
    productId = confirm.json.productId
    const gate = await healPendingRegisterPrePhoto({ limit: 1, productId, dryRun: false })
    if (gate.verifyFailed > 0 || gate.verified < 1) {
      // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 제목 미입력 stub 저장 금지 — manifest
      const stub = await prisma.product.findUnique({
        where: { id: productId },
        select: { title: true },
      })
      if (stub && isSupplierListingTitleUnacceptable(stub.title)) {
        await prisma.product.delete({ where: { id: productId } })
        return { ok: false, reason: 'title_placeholder_not_persisted' }
      }
      return { ok: false, reason: 'pre_photo_verify_failed', productId }
    }
    return { ok: true, productId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[register-pre-photo-ingest-confirm] threw', args.supplier, originUrl, err)
    return { ok: false, reason: `confirm_threw:${msg.slice(0, 160)}`, productId }
  }
}

async function postRegisterInProcess(
  supplier: CanonicalOverseasSupplierKey,
  body: unknown,
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
  const request = new Request('http://127.0.0.1/register-pre-photo-ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const skip = { skipRequireAdmin: true as const }
  const res =
    supplier === 'hanatour'
      ? await handleParseAndRegisterHanatourRequest(request, skip)
      : supplier === 'modetour'
        ? await handleParseAndRegisterModetourRequest(request, skip)
        : supplier === 'ybtour'
          ? await handleParseAndRegisterYbtourRequest(request, skip)
          : supplier === 'verygoodtour'
            ? await handleParseAndRegisterVerygoodtourRequest(request, skip)
            : supplier === 'kyowontour'
              ? await handleParseAndRegisterKyowontourRequest(request, skip)
              : supplier === 'lottetour'
                ? await handleParseAndRegisterLottetourRequest(request, skip)
                : await handleParseAndRegisterNaeiltourRequest(request, skip)
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
