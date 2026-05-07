/**
 * D-5-LLM 백필: 등록·해외 상품의 핵심 포인트를 Gemini로 채웁니다 (교원이지 제외).
 *
 * 환경:
 *   - GEMINI_API_KEY / GEMINI_MODEL (.env.local 등)
 *   - DATABASE_URL
 *   - BACKFILL_HIGHLIGHT_DRY_RUN=true 이면 UPDATE 없이 로그만
 *
 * 실행:
 *   npx tsx scripts/backfill-highlight-llm.ts
 *   npx tsx scripts/backfill-highlight-llm.ts --only-null
 *   npx tsx scripts/backfill-highlight-llm.ts --supplier=modetour
 */
import './load-env-for-scripts'

import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { extractHighlightFromHanatourLLM } from '@/lib/llm-extract-highlight-hanatour'
import { extractHighlightFromLottetourLLM } from '@/lib/llm-extract-highlight-lottetour'
import { extractHighlightFromModetourLLM } from '@/lib/llm-extract-highlight-modetour'
import { extractHighlightFromVerygoodtourLLM } from '@/lib/llm-extract-highlight-verygoodtour'
import { extractHighlightFromYbtourLLM } from '@/lib/llm-extract-highlight-ybtour'
import { normalizeSupplierOrigin, type OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { prisma } from '@/lib/prisma'

const LLM_SLEEP_MS = 1500

function parseArgs(argv: string[]) {
  let onlyNull = false
  let supplier: CanonicalOverseasSupplierKey | null = null
  for (const a of argv) {
    if (a === '--only-null') onlyNull = true
    const m = /^--supplier=(.+)$/.exec(a)
    if (m) {
      const raw = m[1].trim().toLowerCase()
      if (
        raw === 'modetour' ||
        raw === 'hanatour' ||
        raw === 'ybtour' ||
        raw === 'verygoodtour' ||
        raw === 'lottetour'
      ) {
        supplier = raw
      } else {
        console.warn('[backfill-highlight-llm] 알 수 없는 --supplier, 무시:', m[1])
      }
    }
  }
  return { onlyNull, supplier }
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

function buildHighlightBackfillInputBlob(product: {
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

function rowHasAnyHighlight(p: {
  highlightPoints: string | null
  highlightPointsRaw: string | null
}): boolean {
  return Boolean(p.highlightPoints?.trim()) || Boolean(p.highlightPointsRaw?.trim())
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type HighlightLlmSupplierKey = Exclude<OverseasSupplierKey, 'kyowontour' | 'etc'>

function isHighlightLlmSupplierKey(k: OverseasSupplierKey): k is HighlightLlmSupplierKey {
  return k !== 'kyowontour' && k !== 'etc'
}

async function runLlmForSupplier(
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

async function main() {
  const dryRun =
    String(process.env.BACKFILL_HIGHLIGHT_DRY_RUN ?? '')
      .trim()
      .toLowerCase() === 'true'
  const { onlyNull, supplier: supplierArg } = parseArgs(process.argv.slice(2))

  if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim()) {
    console.error('[backfill-highlight-llm] GEMINI_API_KEY(또는 GOOGLE_API_KEY) 없음 — 종료')
    process.exitCode = 1
    return
  }

  console.log('[backfill-highlight-llm] 시작', {
    dryRun,
    onlyNull,
    supplierFilter: supplierArg,
    llmSleepMs: LLM_SLEEP_MS,
  })

  const products = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
    },
    select: {
      id: true,
      originSource: true,
      rawMeta: true,
      benefitSummary: true,
      includedText: true,
      schedule: true,
      highlightPointsRaw: true,
      highlightPoints: true,
    },
  })

  let llmCalls = 0
  let updated = 0
  let skipped = 0

  for (const p of products) {
    const canon = normalizeSupplierOrigin(p.originSource)
    if (!isHighlightLlmSupplierKey(canon)) {
      skipped++
      continue
    }
    if (supplierArg && canon !== supplierArg) {
      skipped++
      continue
    }
    if (onlyNull && rowHasAnyHighlight(p)) {
      skipped++
      continue
    }

    const blob = buildHighlightBackfillInputBlob(p)
    if (blob.trim().length < 80) {
      console.warn('[backfill-highlight-llm] skip short_blob', { id: p.id, originSource: p.originSource })
      skipped++
      continue
    }

    let result: { highlightPointsRaw: string | null; highlightPoints: string | null } | null
    try {
      result = await runLlmForSupplier(canon, blob)
    } catch (e) {
      console.warn('[backfill-highlight-llm] llm_throw', {
        id: p.id,
        originSource: p.originSource,
        err: e instanceof Error ? e.message : String(e),
      })
      skipped++
      await sleep(LLM_SLEEP_MS)
      continue
    }
    llmCalls++
    await sleep(LLM_SLEEP_MS)

    if (!result || (!(result.highlightPointsRaw ?? '').trim() && !(result.highlightPoints ?? '').trim())) {
      console.warn('[backfill-highlight-llm] skip llm_null', { id: p.id, originSource: p.originSource })
      skipped++
      continue
    }

    const payload = {
      highlightPointsRaw: result.highlightPointsRaw ?? null,
      highlightPoints: result.highlightPoints ?? null,
    }

    console.log(
      dryRun ? '[backfill-highlight-llm] dry_run_would_update' : '[backfill-highlight-llm] updating',
      JSON.stringify(
        {
          id: p.id,
          originSource: p.originSource,
          supplier: canon,
          rawLen: (payload.highlightPointsRaw ?? '').length,
          curatedLen: (payload.highlightPoints ?? '').length,
        },
        null,
        0
      )
    )
    if (!dryRun) {
      await prisma.product.update({
        where: { id: p.id },
        data: payload,
      })
      updated++
    }
  }

  console.log('[backfill-highlight-llm] done', { total: products.length, llmCalls, updated, skipped, dryRun })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
