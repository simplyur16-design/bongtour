/**
 * 한진투어 전용 등록 API — `parse-and-register-ybtour` 공용 오케스트레이션 미사용.
 * 미리보기: DEV base 파싱 + 상세 URL 일정 DOM 보강 → ybtour 호환 RegisterParsed.
 */
import { NextResponse } from 'next/server'
import {
  assertRegisterRouteSupplierMatch,
  SupplierRouteMismatchError,
} from '@/lib/assert-supplier-route-match'
import {
  buildHanjintourPreviewResponseParts,
  buildHanjintourProductDraft,
  buildHanjintourRegisterVerificationPreview,
  computeHanjintourPreviewContentDigest,
  pickPastedBlocksFromBody,
} from '@/lib/hanjintour-register-preview-from-base'
import { issuePreviewToken, verifyPreviewToken } from '@/lib/registration-preview-token'
import type { RegisterParsed } from '@/lib/register-llm-parsed-bridge'
import { stripRegisterInternalArtifacts } from '@/lib/register-llm-parsed-bridge'
import { runHanjintourParseAndRegisterDev } from '@/DEV/lib/parse-and-register-hanjintour-orchestration'

export async function handleParseAndRegisterHanjintourRequest(request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ success: false, error: '요청 본문이 올바른 JSON이 아닙니다.' }, { status: 400 })
  }

  try {
    assertRegisterRouteSupplierMatch('hanjintour', body.originSource, {
      route: '/api/travel/parse-and-register-hanjintour',
    })
  } catch (e) {
    if (e instanceof SupplierRouteMismatchError) {
      return NextResponse.json(
        {
          success: false,
          error: e.message,
          expectedSupplier: e.expectedSupplier,
          receivedOriginSource: e.receivedRaw,
          normalizedSupplier: e.normalized,
          route: e.route,
        },
        { status: 400 }
      )
    }
    throw e
  }

  const mode = body.mode === 'confirm' ? 'confirm' : 'preview'
  const text = typeof body.text === 'string' ? body.text : ''
  const originUrlRaw = typeof body.originUrl === 'string' ? body.originUrl.trim() : ''
  const originUrl = originUrlRaw || null
  const optTableSsot = pickPastedBlocksFromBody(body)?.optionalTour ?? null

  if (mode === 'preview') {
    const orch = await runHanjintourParseAndRegisterDev({
      detailHtml: text,
      detailUrl: originUrlRaw,
      runScraper: false,
      optionalTourTableSsot: optTableSsot,
    })
    const parts = buildHanjintourPreviewResponseParts({
      base: orch.base,
      body,
      text,
      originUrl,
    })
    const previewToken = issuePreviewToken('hanjintour', parts.parsed.originCode)
    return NextResponse.json({
      success: true,
      mode: 'preview' as const,
      previewToken,
      previewContentDigest: parts.previewContentDigest,
      productDraft: parts.productDraft,
      departureDrafts: [],
      itineraryDayDrafts: parts.itineraryDayDrafts,
      parsed: parts.parsed,
      autoExtracted: parts.autoExtracted,
      manualPasted: parts.manualPasted,
      geminiInferred: parts.geminiInferred,
      fieldIssues: [],
      registerVerification: parts.registerVerification,
      hanjintourDev: {
        scrape_failures: orch.scrape_failures,
        derived_count: orch.derived_products.length,
        parse_notes: orch.base.parse_notes,
      },
    })
  }

  const previewToken = typeof body.previewToken === 'string' ? body.previewToken : ''
  const merged = body.parsed as RegisterParsed | undefined
  if (!merged?.originCode) {
    return NextResponse.json({ success: false, error: 'confirm에는 미리보기 parsed가 필요합니다.' }, { status: 400 })
  }
  const stripped = stripRegisterInternalArtifacts(merged)
  if (!verifyPreviewToken(previewToken, 'hanjintour', stripped.originCode)) {
    return NextResponse.json({ success: false, error: '미리보기 토큰이 유효하지 않습니다.' }, { status: 400 })
  }
  const digest = typeof body.previewContentDigest === 'string' ? body.previewContentDigest : ''
  if (digest !== computeHanjintourPreviewContentDigest(body)) {
    return NextResponse.json(
      { success: false, error: '미리보기 본문 지문이 일치하지 않습니다. 다시 미리보기 하세요.' },
      { status: 400 }
    )
  }

  const productDraft = buildHanjintourProductDraft(stripped)
  const registerVerification = buildHanjintourRegisterVerificationPreview({
    parsed: stripped,
    productDraft,
    phase: 'confirm',
  })

  return NextResponse.json({
    success: true,
    productId: null,
    registerVerification,
    adminTracePath: null,
    hanjintourNote: 'hanjintour: Prisma 3축 저장은 미연결(미리보기·검증 전용).',
  })
}
