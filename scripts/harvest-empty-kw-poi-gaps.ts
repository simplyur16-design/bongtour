/**
 * emptyKw URL만 재변환 → 중간일 route 세그먼트 중 mapKoreanPoiSegment 실패 목록.
 *   npx tsx scripts/harvest-empty-kw-poi-gaps.ts
 */
import './load-env-for-scripts'
import fs from 'node:fs'
import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'
import { englishFromScheduleKoreanSegment } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { splitRouteTextPlaceSegments } from '@/lib/register-schedule-llm-image-keyword-fallback'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { parseYbtourRegisterFromApi } from '@/lib/ybtour-register-api-parse'
import { augmentYbtourParsedWithDetailCollect } from '@/lib/ybtour-register-detail-collect'
import { parseModetourRegisterFromApi } from '@/lib/modetour-register-api-parse'
import { augmentModetourParsedWithDetailCollect } from '@/lib/modetour-register-detail-collect'
import { parseHanatourRegisterFromApi } from '@/lib/hanatour-register-api-parse'
import { augmentHanatourParsedWithDetailCollect } from '@/lib/hanatour-register-detail-collect'
import { parseLottetourRegisterFromApi } from '@/lib/lottetour-register-api-parse'
import { augmentLottetourParsedWithDetailCollect } from '@/lib/lottetour-register-detail-collect'
import { parseKyowontourRegisterFromApi } from '@/lib/kyowontour-register-api-parse'
import { augmentKyowontourParsedWithTabDataCollect } from '@/lib/kyowontour-register-tab-data-collect'
import { applyRegisterPostAugmentSchedulePipeline } from '@/lib/register-parse-post-augment'

process.env.SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI ??= '1'

type Supplier = Extract<
  CanonicalOverseasSupplierKey,
  'ybtour' | 'lottetour' | 'kyowontour' | 'hanatour' | 'modetour'
>

function detectSupplier(url: string): Supplier | null {
  if (/ybtour\.co\.kr/i.test(url)) return 'ybtour'
  if (/lottetour\.com/i.test(url)) return 'lottetour'
  if (/kyowontour\.com/i.test(url)) return 'kyowontour'
  if (/hanatour\.com/i.test(url)) return 'hanatour'
  if (/modetour\.com/i.test(url)) return 'modetour'
  return null
}

async function convertPreview(supplier: Supplier, url: string, paste: string, bundle: unknown) {
  const opts = { originUrl: url, travelScope: 'package' as const, prefetchedFactBundle: bundle }
  let parsed: Record<string, unknown>
  switch (supplier) {
    case 'ybtour': {
      const sk = await parseYbtourRegisterFromApi(paste, 'ybtour', opts)
      parsed = (await augmentYbtourParsedWithDetailCollect(sk, { originUrl: url })) as Record<string, unknown>
      break
    }
    case 'modetour': {
      const sk = await parseModetourRegisterFromApi(paste, 'modetour', opts)
      parsed = (await augmentModetourParsedWithDetailCollect(sk, { originUrl: url })) as Record<string, unknown>
      break
    }
    case 'hanatour': {
      const sk = await parseHanatourRegisterFromApi(paste, 'hanatour', opts)
      parsed = (await augmentHanatourParsedWithDetailCollect(sk, { originUrl: url })) as Record<string, unknown>
      break
    }
    case 'lottetour': {
      const sk = await parseLottetourRegisterFromApi(paste, 'lottetour', opts)
      parsed = (await augmentLottetourParsedWithDetailCollect(sk, { originUrl: url })) as Record<string, unknown>
      break
    }
    case 'kyowontour': {
      const sk = await parseKyowontourRegisterFromApi(paste, 'kyowontour', opts)
      parsed = (await augmentKyowontourParsedWithTabDataCollect(sk, { originUrl: url })) as Record<string, unknown>
      break
    }
  }
  parsed = (await applyRegisterPostAugmentSchedulePipeline(parsed, {
    forcedBrandKey: supplier,
    travelScope: 'package',
    mode: 'preview',
    logPrefix: 'harvest',
  })) as Record<string, unknown>
  return (parsed.schedule as Array<Record<string, unknown>>) ?? []
}

async function main() {
  const batch = JSON.parse(fs.readFileSync('scripts/data/facts-vs-convert-full-2026-07-13.json', 'utf8')) as {
    rows: Array<{ url: string; emptyKwMiddle?: number }>
  }
  const urls = [...new Set(batch.rows.filter((r) => (r.emptyKwMiddle ?? 0) > 0).map((r) => r.url))]
  console.log(`harvest ${urls.length} emptyKw URLs\n`)

  const gapCount = new Map<string, number>()
  const gapExamples = new Map<string, string>()

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!
    const supplier = detectSupplier(url)
    if (!supplier) continue
    process.stderr.write(`… ${i + 1}/${urls.length} ${supplier}\n`)
    try {
      const bundle = await collectSupplierRegisterFacts(supplier, url)
      if (!bundle) continue
      const paste = registerFactBundleToPasteText(bundle)
      const schedule = await convertPreview(supplier, url, paste, bundle)
      const days = schedule.filter((r) => Number(r.day) > 0)
      const maxDay = days.length ? Math.max(...days.map((r) => Number(r.day))) : 0
      for (const row of days) {
        const d = Number(row.day)
        if (d >= maxDay && days.length > 1) continue
        const kw = String(row.imageKeyword ?? '').trim()
        if (kw) continue
        const route = String(row.routeText ?? '').trim()
        const title = String(row.title ?? '').trim()
        const segs = [
          ...splitRouteTextPlaceSegments(route),
          ...(title && title !== `${d}일차` ? [title] : []),
        ]
        for (const seg of segs) {
          const s = seg.trim()
          if (s.length < 2 || s.length > 40) continue
          if (/인천|김포|출발|도착|이동|조식|중식|석식|호텔|자유|체크/i.test(s)) continue
          const mapped = mapKoreanPoiSegment(s) || englishFromScheduleKoreanSegment(s)
          if (mapped) continue
          gapCount.set(s, (gapCount.get(s) ?? 0) + 1)
          if (!gapExamples.has(s)) gapExamples.set(s, url.slice(0, 80))
        }
      }
    } catch (e) {
      console.error('fail', url.slice(0, 60), e instanceof Error ? e.message : e)
    }
  }

  const ranked = [...gapCount.entries()].sort((a, b) => b[1] - a[1])
  const out = {
    harvestedAt: new Date().toISOString(),
    urlCount: urls.length,
    gaps: ranked.map(([seg, n]) => ({ seg, n, example: gapExamples.get(seg) })),
  }
  fs.writeFileSync('scripts/data/empty-kw-poi-gaps.json', JSON.stringify(out, null, 2), 'utf8')
  console.log('\n=== top gaps ===')
  for (const g of out.gaps.slice(0, 80)) {
    console.log(`${g.n}x\t${g.seg}`)
  }
  console.log(`\nwrote scripts/data/empty-kw-poi-gaps.json (${out.gaps.length} unique)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
