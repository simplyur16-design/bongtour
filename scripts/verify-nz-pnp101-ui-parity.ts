/**
 * PNP101 — server parse vs admin UI buildRegisterPexelsUiRows 동일 결과 검증.
 * npx tsx scripts/verify-nz-pnp101-ui-parity.ts
 */
import './load-env-for-scripts'

import assert from 'node:assert/strict'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { applyRegisterScheduleImageKeywordsForPreview } from '@/lib/register-schedule-image-keywords-preview'
import { finalizeRegisterScheduleImageKeywords } from '@/lib/schedule-image-keyword-persist'
import { enrichHanatourRegisterPreviewScheduleRowsFromSection } from '@/lib/hanatour-schedule-section-by-day'

const URL =
  'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=PNP101260802KE1&prePage=major-products'

process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI = '1'

async function main() {
  const parsed = await augmentHanatourParsedWithDetailCollect(
    { originUrl: URL } as Parameters<typeof augmentHanatourParsedWithDetailCollect>[0],
    { originUrl: URL },
  )

  console.log('=== server schedule after ensureHanatour (Gemini skipped) ===')
  for (const r of parsed.schedule ?? []) {
    console.log(
      `  d${r.day} title=${JSON.stringify(r.title)} kw1=${JSON.stringify(r.imageKeyword)} kw2=${JSON.stringify(r.imageKeyword2)}`,
    )
  }

  const rawRows = enrichHanatourRegisterPreviewScheduleRowsFromSection(
    (parsed.schedule ?? []).map((row) => ({
      day: Number(row.day),
      title: String(row.title ?? ''),
      description: String(row.description ?? ''),
      routeText: String(row.routeText ?? '').trim() || null,
      imageKeyword: String(row.imageKeyword ?? '').trim(),
      imageKeyword2: String(row.imageKeyword2 ?? '').trim() || null,
    })),
    parsed.detailBodyStructured ?? null,
  )

  let uiRows
  try {
    const augmented = applyRegisterScheduleImageKeywordsForPreview(rawRows, {
      supplierKey: 'hanatour',
      productDestination: parsed.destination ?? '뉴질랜드',
      productTitle: parsed.title ?? '',
    })
    uiRows = finalizeRegisterScheduleImageKeywords(augmented, {
      productDestination: parsed.destination ?? '뉴질랜드',
    })
  } catch (e) {
    console.error('UI apply THREW — would show stale parsed keywords:', e)
    process.exit(1)
  }

  console.log('\n=== UI path (enrich + apply + finalize) ===')
  for (const r of uiRows) {
    console.log(`  d${r.day} kw1=${JSON.stringify(r.imageKeyword)} kw2=${JSON.stringify(r.imageKeyword2)}`)
  }

  const d1 = uiRows.find((r) => r.day === 1)
  const d5 = uiRows.find((r) => r.day === 5)
  assert.match(String(d1?.imageKeyword ?? ''), /Kawarau|Arrowtown/i, 'UI d1 must not be empty')
  assert.match(String(d5?.imageKeyword ?? ''), /Hagley|Avon/i, 'UI d5 must not be Savage Memorial')
  assert.doesNotMatch(String(d5?.imageKeyword ?? ''), /Savage Memorial/i)
  console.log('\nPASSED: UI parity')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
