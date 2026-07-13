/**
 * 운영자 URL 전수 — 사실가져오기 vs 봉투어변환(bundle) 시간 + route/kw 정확성.
 *
 *   $env:SKIP_REGISTER_SCHEDULE_IMAGE_KEYWORD_GEMINI='1'  # optional; preview already skips Gemini
 *   npx tsx scripts/bench-register-facts-vs-convert-batch.ts
 *   npx tsx scripts/bench-register-facts-vs-convert-batch.ts --limit 5
 *   npx tsx scripts/bench-register-facts-vs-convert-batch.ts --json-out scripts/data/facts-vs-convert-2026-07-13.json
 */
import './load-env-for-scripts'

import fs from 'node:fs'
import path from 'node:path'

import { collectSupplierRegisterFacts } from '@/lib/register-facts/collect'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { registerFactBundleToPasteText } from '@/lib/register-facts-to-paste-text'
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

const DEFAULT_URLS = path.join(
  process.cwd(),
  'scripts/data/operator-url-batch-2026-07-13-full.txt',
)

function detectSupplier(url: string): Supplier | null {
  if (/ybtour\.co\.kr/i.test(url)) return 'ybtour'
  if (/lottetour\.com/i.test(url)) return 'lottetour'
  if (/kyowontour\.com/i.test(url)) return 'kyowontour'
  if (/hanatour\.com/i.test(url)) return 'hanatour'
  if (/modetour\.com/i.test(url)) return 'modetour'
  return null
}

function loadUrls(file: string): string[] {
  const raw = fs.readFileSync(file, 'utf8')
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    if (!/^https?:\/\//i.test(t)) continue
    if (seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function ms(n: number): string {
  return `${(n / 1000).toFixed(1)}s`
}

function isPlaceholderDayTitle(title: string, day: number): boolean {
  const t = title.trim()
  if (!t) return true
  return new RegExp(`^${day}\\s*일차$`).test(t) || /^DAY\s*\d+$/i.test(t)
}

/** 일정요약(title)·일정설명(description)·route·imageKeyword 채움률 */
function scheduleQuality(schedule: Array<Record<string, unknown>>): {
  days: number
  routeFill: number
  titleFill: number
  descFill: number
  kw1Fill: number
  emptyRouteMiddle: number
  emptyTitleMiddle: number
  emptyDescMiddle: number
  emptyKwMiddle: number
} {
  const days = schedule.filter((r) => Number(r.day) > 0)
  const maxDay = days.length ? Math.max(...days.map((r) => Number(r.day))) : 0
  let routeFill = 0
  let titleFill = 0
  let descFill = 0
  let kw1Fill = 0
  let emptyRouteMiddle = 0
  let emptyTitleMiddle = 0
  let emptyDescMiddle = 0
  let emptyKwMiddle = 0
  for (const r of days) {
    const d = Number(r.day)
    const isMiddle = d < maxDay || days.length === 1
    const route = String(r.routeText ?? '').trim()
    const title = String(r.title ?? '').trim()
    const desc = String(r.description ?? '').trim()
    const kw = String(r.imageKeyword ?? '').trim()
    if (route) routeFill += 1
    if (title && !isPlaceholderDayTitle(title, d)) titleFill += 1
    if (desc.length >= 8) descFill += 1
    if (kw) kw1Fill += 1
    if (isMiddle) {
      if (!route) emptyRouteMiddle += 1
      if (!title || isPlaceholderDayTitle(title, d)) emptyTitleMiddle += 1
      if (desc.length < 8) emptyDescMiddle += 1
      if (!kw) emptyKwMiddle += 1
    }
  }
  return {
    days: days.length,
    routeFill,
    titleFill,
    descFill,
    kw1Fill,
    emptyRouteMiddle,
    emptyTitleMiddle,
    emptyDescMiddle,
    emptyKwMiddle,
  }
}

async function convertPreview(
  supplier: Supplier,
  url: string,
  paste: string,
  bundle: SupplierRegisterFactBundle,
): Promise<{ schedule: Array<Record<string, unknown>>; title: string }> {
  const opts = {
    originUrl: url,
    travelScope: 'package' as const,
    prefetchedFactBundle: bundle,
  }
  let parsed: Record<string, unknown>
  switch (supplier) {
    case 'ybtour': {
      const skeleton = await parseYbtourRegisterFromApi(paste, 'ybtour', opts)
      parsed = (await augmentYbtourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<
        string,
        unknown
      >
      break
    }
    case 'modetour': {
      const skeleton = await parseModetourRegisterFromApi(paste, 'modetour', opts)
      parsed = (await augmentModetourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<
        string,
        unknown
      >
      break
    }
    case 'hanatour': {
      const skeleton = await parseHanatourRegisterFromApi(paste, 'hanatour', opts)
      parsed = (await augmentHanatourParsedWithDetailCollect(skeleton, { originUrl: url })) as Record<
        string,
        unknown
      >
      break
    }
    case 'lottetour': {
      const skeleton = await parseLottetourRegisterFromApi(paste, 'lottetour', opts)
      parsed = (await augmentLottetourParsedWithDetailCollect(skeleton, {
        originUrl: url,
      })) as Record<string, unknown>
      break
    }
    case 'kyowontour': {
      const skeleton = await parseKyowontourRegisterFromApi(paste, 'kyowontour', opts)
      parsed = (await augmentKyowontourParsedWithTabDataCollect(skeleton, {
        originUrl: url,
      })) as Record<string, unknown>
      break
    }
    default:
      throw new Error(`unsupported ${supplier}`)
  }
  parsed = (await applyRegisterPostAugmentSchedulePipeline(parsed, {
    forcedBrandKey: supplier,
    travelScope: 'package',
    mode: 'preview',
    logPrefix: `batch-${supplier}`,
  })) as Record<string, unknown>
  return {
    schedule: ((parsed.schedule as Array<Record<string, unknown>>) ?? []).slice(),
    title: String(parsed.title ?? '').slice(0, 64),
  }
}

async function main() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : Infinity
  const jsonOutIdx = args.indexOf('--json-out')
  const jsonOut = jsonOutIdx >= 0 ? args[jsonOutIdx + 1] : null
  const urlsFileIdx = args.indexOf('--urls-file')
  const urlsFile = urlsFileIdx >= 0 ? args[urlsFileIdx + 1] : DEFAULT_URLS

  const urls = loadUrls(urlsFile).slice(0, Number.isFinite(limit) ? limit : undefined)
  console.log(`=== facts vs convert batch — ${urls.length} URLs (preview=rules-only) ===\n`)

  const rows: Array<Record<string, unknown>> = []
  let convertSlower = 0
  let qualityFail = 0

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!
    const supplier = detectSupplier(url)
    const label = `${i + 1}/${urls.length} ${supplier ?? '?'}`
    if (!supplier) {
      console.log(`[skip] ${label} unknown supplier`)
      continue
    }
    process.stderr.write(`… ${label}\n`)
    try {
      const t0 = Date.now()
      const bundle = await collectSupplierRegisterFacts(supplier, url)
      const factsMs = Date.now() - t0
      if (!bundle) {
        rows.push({ url, supplier, error: 'facts_null', factsMs })
        qualityFail += 1
        console.log(`[fail] ${label} facts null (${ms(factsMs)})`)
        continue
      }
      const paste = registerFactBundleToPasteText(bundle)
      const t1 = Date.now()
      const converted = await convertPreview(supplier, url, paste, bundle)
      const convertMs = Date.now() - t1
      const q = scheduleQuality(converted.schedule)
      const slower = convertMs > factsMs + 250
      if (slower) convertSlower += 1
      const bad =
        q.days === 0 ||
        q.emptyRouteMiddle > 0 ||
        q.emptyTitleMiddle > 0 ||
        q.emptyDescMiddle > 0 ||
        q.emptyKwMiddle > 0 ||
        (q.days >= 2 && q.kw1Fill === 0)
      if (bad) qualityFail += 1
      const row = {
        url,
        supplier,
        factsMs,
        convertMs,
        convertSlowerThanFacts: slower,
        ...q,
        title: converted.title,
        ok: !bad && !slower,
        sampleDay: converted.schedule.find((r) => Number(r.day) === 1) ?? null,
      }
      rows.push(row)
      console.log(
        `[${bad || slower ? 'WARN' : 'ok'}] ${label} facts=${ms(factsMs)} convert=${ms(convertMs)}` +
          ` days=${q.days} route=${q.routeFill}/${q.days}` +
          ` title=${q.titleFill}/${q.days} desc=${q.descFill}/${q.days} kw1=${q.kw1Fill}/${q.days}` +
          (slower ? ' CONVERT>FACTS' : '') +
          (q.emptyRouteMiddle ? ` emptyRoute=${q.emptyRouteMiddle}` : '') +
          (q.emptyTitleMiddle ? ` emptyTitle=${q.emptyTitleMiddle}` : '') +
          (q.emptyDescMiddle ? ` emptyDesc=${q.emptyDescMiddle}` : '') +
          (q.emptyKwMiddle ? ` emptyKw=${q.emptyKwMiddle}` : ''),
      )
    } catch (e) {
      qualityFail += 1
      const msg = e instanceof Error ? e.message : String(e)
      rows.push({ url, supplier, error: msg.slice(0, 240) })
      console.log(`[fail] ${label} ${msg.slice(0, 120)}`)
    }
  }

  const summary = {
    total: rows.length,
    convertSlowerThanFacts: convertSlower,
    qualityFail,
    avgFactsMs: Math.round(
      rows.filter((r) => typeof r.factsMs === 'number').reduce((s, r) => s + Number(r.factsMs), 0) /
        Math.max(1, rows.filter((r) => typeof r.factsMs === 'number').length),
    ),
    avgConvertMs: Math.round(
      rows.filter((r) => typeof r.convertMs === 'number').reduce((s, r) => s + Number(r.convertMs), 0) /
        Math.max(1, rows.filter((r) => typeof r.convertMs === 'number').length),
    ),
  }
  console.log('\n=== summary ===')
  console.log(JSON.stringify(summary, null, 2))

  if (jsonOut) {
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true })
    fs.writeFileSync(jsonOut, JSON.stringify({ summary, rows }, null, 2), 'utf8')
    console.log(`wrote ${jsonOut}`)
  }

  if (convertSlower > 0) {
    console.error(`\nFAIL: ${convertSlower} URL(s) where convert > facts`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
