import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { adminProductJsonWithPromotionRef } from '@/lib/admin-product-reference-prices'
import { extractHighlightFromHanatourLLM } from '@/lib/llm-extract-highlight-hanatour'
import { extractHighlightFromLottetourLLM } from '@/lib/llm-extract-highlight-lottetour'
import { extractHighlightFromModetourLLM } from '@/lib/llm-extract-highlight-modetour'
import { extractHighlightFromVerygoodtourLLM } from '@/lib/llm-extract-highlight-verygoodtour'
import { extractHighlightFromYbtourLLM } from '@/lib/llm-extract-highlight-ybtour'
import { normalizeSupplierOrigin, type OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'

type RouteParams = { params: Promise<{ id: string }> }

const MAX_HIGHLIGHT_POINTS_LEN = 5000

function truncateHighlight(s: string | null): string | null {
  if (s == null) return null
  const t = s.trim()
  if (!t) return null
  return t.length > MAX_HIGHLIGHT_POINTS_LEN ? t.slice(0, MAX_HIGHLIGHT_POINTS_LEN) : t
}

function parseRawMetaObject(rawMeta: string | null): Record<string, unknown> | null {
  if (!rawMeta?.trim()) return null
  try {
    const v = JSON.parse(rawMeta) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function pushStructuredStrings(ss: Record<string, unknown>, parts: string[]) {
  const keys = [
    'detailBodyNormalizedRaw',
    'flightRaw',
    'priceTableRawText',
    'normalizedRaw',
    'detailBodyRaw',
  ]
  for (const k of keys) {
    const v = ss[k]
    if (typeof v === 'string' && v.trim()) parts.push(v.trim())
  }
}

function buildHighlightLlmInputBlob(product: {
  rawMeta: string | null
  benefitSummary: string | null
  includedText: string | null
  schedule: string | null
}): string {
  const parts: string[] = []
  const rm = parseRawMetaObject(product.rawMeta)
  const ss = rm?.structuredSignals
  if (ss && typeof ss === 'object' && !Array.isArray(ss)) {
    pushStructuredStrings(ss as Record<string, unknown>, parts)
  }
  if (product.benefitSummary?.trim()) parts.push(product.benefitSummary.trim())
  if (product.includedText?.trim()) parts.push(product.includedText.trim())
  if (parts.join('\n').length < 400 && product.schedule?.trim()) {
    parts.push(product.schedule.trim().slice(0, 80_000))
  }
  return parts.join('\n\n---\n\n')
}

type HighlightLlmSupplierKey = Exclude<OverseasSupplierKey, 'kyowontour' | 'etc'>

function isHighlightLlmSupplierKey(k: OverseasSupplierKey): k is HighlightLlmSupplierKey {
  return k !== 'kyowontour' && k !== 'etc'
}

async function runSupplierHighlightLlm(
  key: HighlightLlmSupplierKey,
  blob: string
): Promise<{ highlightPointsRaw: string | null; highlightPoints: string | null } | null> {
  switch (key) {
    case 'modetour':
      return extractHighlightFromModetourLLM(blob)
    case 'hanatour':
      return extractHighlightFromHanatourLLM(blob)
    case 'ybtour':
      return extractHighlightFromYbtourLLM(blob)
    case 'verygoodtour':
      return extractHighlightFromVerygoodtourLLM(blob)
    case 'lottetour':
      return extractHighlightFromLottetourLLM(blob)
  }
}

/**
 * POST — Gemini로 highlightPointsRaw / highlightPoints 재생성 (교원이지 미지원).
 */
export async function POST(_req: Request, ctx: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params
  const product = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      originSource: true,
      rawMeta: true,
      benefitSummary: true,
      includedText: true,
      schedule: true,
    },
  })
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const canon = normalizeSupplierOrigin(product.originSource)
  if (canon === 'kyowontour') {
    return NextResponse.json(
      { error: '교원이지 상품은 이미지 중심 등록 경로라 핵심 포인트 LLM 재생성을 지원하지 않습니다.' },
      { status: 400 }
    )
  }
  if (!isHighlightLlmSupplierKey(canon)) {
    return NextResponse.json({ error: '공급사 출처를 알 수 없어 LLM 추출을 실행할 수 없습니다.' }, { status: 400 })
  }

  if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되어 있지 않습니다.' }, { status: 503 })
  }

  const blob = buildHighlightLlmInputBlob(product)
  if (blob.trim().length < 80) {
    return NextResponse.json(
      { error: '원문(rawMeta 등)이 너무 짧아 핵심 포인트 추출을 할 수 없습니다.' },
      { status: 422 }
    )
  }

  let result: { highlightPointsRaw: string | null; highlightPoints: string | null } | null
  try {
    result = await runSupplierHighlightLlm(canon, blob)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[highlight-llm]', product.id, msg)
    return NextResponse.json({ error: `Gemini 호출 실패: ${msg}` }, { status: 502 })
  }

  if (
    !result ||
    (!(result.highlightPointsRaw ?? '').trim() && !(result.highlightPoints ?? '').trim())
  ) {
    return NextResponse.json(
      { error: '모델이 유효한 핵심 포인트를 반환하지 않았습니다. 원문에 해당 블록이 없거나 검증에 실패했을 수 있습니다.' },
      { status: 422 }
    )
  }

  const data: Prisma.ProductUpdateInput = {
    highlightPointsRaw: truncateHighlight(result.highlightPointsRaw),
    highlightPoints: truncateHighlight(result.highlightPoints),
  }

  const updated = await prisma.product.update({
    where: { id },
    data,
  })

  const json = adminProductJsonWithPromotionRef(updated)

  return NextResponse.json({
    ok: true,
    highlightPointsRaw: updated.highlightPointsRaw,
    highlightPoints: updated.highlightPoints,
    product: json,
  })
}
