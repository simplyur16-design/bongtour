/**
 * 상품 대표 히어로 이미지(cities/*, places/*) Supabase 구형 객체 GC.
 *
 * GC 대상 버킷: env `SUPABASE_IMAGE_BUCKET`(기본 bongtour-images).
 * 구형 식별: 파일명이 `{geo}-{source}-{id}` 가 아니고, 마지막 토큰이 숫자 id(구 Pexels 재호스팅)인 경우.
 *
 * 사용법 (1차는 항상 dry-run):
 *   npx tsx scripts/gc-product-hero-storage.ts --dry-run
 *   npx tsx scripts/gc-product-hero-storage.ts --dry-run --max-delete=50 --min-age-hours=72
 *   npx tsx scripts/gc-product-hero-storage.ts --apply --max-delete=10 --json-log=./tmp/gc-hero.jsonl
 *
 * 옵션:
 *   --dry-run | --apply
 *   --prefix=cities   (여러 번 가능; 기본 cities + places 루트)
 *   --path-substring=da-nang   (경로에 부분문자열 포함할 때만 후보)
 *   --min-age-hours=N   (created_at 기준 N시간 미만이면 제외; Supabase가 날짜를 안 주면 스킵 안 함)
 *   --max-delete=N      (apply 시 최대 삭제 개수)
 *   --require-superseded   (동일 폴더에 신규 규칙 파일이 같은 숫자 id로 존재할 때만 후보)
 *   --filter-source=pexels (--require-superseded 시 신규 파일 source 세그먼트 제한; 여러 번 가능)
 *   --json-log=path     (각 행 JSONL 추가)
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'
import './load-env-for-scripts'
import { prisma } from '../lib/prisma'
import {
  getImageStorageBucket,
  getObjectStorageEnv,
  isObjectStorageConfigured,
  listStorageObjectKeysRecursive,
  removeStorageObjectsBatched,
} from '../lib/object-storage'
import {
  basenameWithoutExtension,
  buildNewFormatBasenamesByDir,
  classifyProductHeroStorageKey,
  collectReferencedProductHeroObjectKeys,
  DEFAULT_PRODUCT_HERO_GC_ROOTS,
  isGcDeletionCandidate,
  keyMatchesAnyPrefix,
  normalizeStorageObjectKey,
  objectKeyDirAndBasename,
  type ProductHeroGcRow,
} from '../lib/product-hero-storage-gc'
import { HERO_FILENAME_SOURCE_SEGMENTS } from '../lib/product-hero-image-source-type'

type Cli = {
  apply: boolean
  dryRun: boolean
  prefixes: string[]
  pathSubstring: string | null
  minAgeHours: number | null
  maxDelete: number | null
  requireSuperseded: boolean
  filterSources: string[]
  jsonLog: string | null
}

function parseCli(argv: string[]): Cli {
  const prefixes: string[] = []
  const filterSources: string[] = []
  let apply = false
  let dryRun = false
  let pathSubstring: string | null = null
  let minAgeHours: number | null = null
  let maxDelete: number | null = null
  let requireSuperseded = false
  let jsonLog: string | null = null

  for (const a of argv) {
    if (a === '--apply') apply = true
    else if (a === '--dry-run') dryRun = true
    else if (a === '--require-superseded') requireSuperseded = true
    else if (a.startsWith('--prefix=')) prefixes.push(a.slice('--prefix='.length).trim())
    else if (a.startsWith('--path-substring=')) pathSubstring = a.slice('--path-substring='.length).trim() || null
    else if (a.startsWith('--min-age-hours=')) {
      const n = Number(a.slice('--min-age-hours='.length))
      minAgeHours = Number.isFinite(n) && n > 0 ? n : null
    } else if (a.startsWith('--max-delete=')) {
      const n = Number(a.slice('--max-delete='.length))
      maxDelete = Number.isFinite(n) && n > 0 ? Math.floor(n) : null
    } else if (a.startsWith('--filter-source=')) {
      const s = a.slice('--filter-source='.length).trim().toLowerCase()
      if (s) filterSources.push(s)
    } else if (a.startsWith('--json-log=')) {
      jsonLog = a.slice('--json-log='.length).trim() || null
    }
  }
  if (!dryRun && !apply) dryRun = true
  if (apply && dryRun) dryRun = false
  return {
    apply,
    dryRun,
    prefixes: prefixes.length > 0 ? prefixes : [...DEFAULT_PRODUCT_HERO_GC_ROOTS],
    pathSubstring,
    minAgeHours,
    maxDelete,
    requireSuperseded,
    filterSources,
    jsonLog,
  }
}

function logJson(path: string | null, obj: Record<string, unknown>) {
  if (!path) return
  const full = resolve(process.cwd(), path)
  const line = JSON.stringify({ ts: new Date().toISOString(), ...obj }) + '\n'
  try {
    mkdirSync(dirname(full), { recursive: true })
  } catch {
    /* exists */
  }
  appendFileSync(full, line, 'utf8')
}

function tooYoung(created_at: string | undefined, minAgeHours: number | null): boolean {
  if (!minAgeHours || !created_at) return false
  const t = new Date(created_at).getTime()
  if (!Number.isFinite(t)) return false
  const ageMs = Date.now() - t
  return ageMs < minAgeHours * 3600 * 1000
}

function main(): Promise<void> {
  const cli = parseCli(process.argv.slice(2))

  if (!isObjectStorageConfigured()) {
    console.error('[gc-product-hero-storage] SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요')
    process.exit(1)
  }

  const env = getObjectStorageEnv()
  const bucket = getImageStorageBucket()

  console.log('[gc-product-hero-storage] bucket:', bucket)
  console.log('[gc-product-hero-storage] publicBaseUrl:', env.publicBaseUrl)
  console.log('[gc-product-hero-storage] list prefixes:', cli.prefixes.join(', '))
  console.log('[gc-product-hero-storage] mode:', cli.apply ? 'APPLY' : 'DRY-RUN')
  console.log('[gc-product-hero-storage] require-superseded:', cli.requireSuperseded)
  if (cli.pathSubstring) console.log('[gc-product-hero-storage] path-substring:', cli.pathSubstring)
  if (cli.minAgeHours) console.log('[gc-product-hero-storage] min-age-hours:', cli.minAgeHours)
  if (cli.maxDelete != null) console.log('[gc-product-hero-storage] max-delete:', cli.maxDelete)
  if (cli.filterSources.length)
    console.log('[gc-product-hero-storage] filter-source:', cli.filterSources.join(', '))

  const supersedeSegs =
    cli.filterSources.length > 0
      ? new Set(cli.filterSources.filter((s) => HERO_FILENAME_SOURCE_SEGMENTS.has(s)))
      : null
  if (cli.filterSources.length && (!supersedeSegs || supersedeSegs.size === 0)) {
    console.error('[gc-product-hero-storage] --filter-source 값이 canonical 세그먼트에 없음:', cli.filterSources.join(','))
    process.exit(1)
  }
  if (cli.filterSources.length && !cli.requireSuperseded) {
    console.warn('[gc-product-hero-storage] 참고: --filter-source 는 --require-superseded 와 함께 쓸 때 의미가 있습니다.')
  }

  return (async () => {
    const products = await prisma.product.findMany({
      select: { bgImageUrl: true, bgImageStoragePath: true },
    })
    const referenced = collectReferencedProductHeroObjectKeys(products)
    console.log('[gc-product-hero-storage] products:', products.length, 'referenced object keys:', referenced.size)

    const byKey = new Map<string, { objectKey: string; created_at?: string; updated_at?: string }>()
    let truncated = false
    for (const root of cli.prefixes) {
      const r = await listStorageObjectKeysRecursive({ prefix: root.replace(/^\/+/, '').replace(/\/+$/, '') })
      truncated = truncated || r.truncated
      for (const o of r.objects) {
        const k = normalizeStorageObjectKey(o.objectKey)
        if (!byKey.has(k)) byKey.set(k, { objectKey: k, created_at: o.created_at, updated_at: o.updated_at })
      }
    }
    const uniqueKeys = [...byKey.values()]
    const allKeySet = new Set(uniqueKeys.map((x) => x.objectKey))
    const newFormatByDir = buildNewFormatBasenamesByDir(allKeySet)
    console.log('[gc-product-hero-storage] storage files scanned:', uniqueKeys.length, truncated ? '(TRUNCATED)' : '')

    const rows: ProductHeroGcRow[] = []
    let skippedMinAge = 0
    for (const o of uniqueKeys) {
      if (!keyMatchesAnyPrefix(o.objectKey, cli.prefixes)) continue
      if (cli.pathSubstring && !o.objectKey.includes(cli.pathSubstring)) continue
      const row = classifyProductHeroStorageKey({
        objectKey: o.objectKey,
        referencedKeys: referenced,
        allKeys: allKeySet,
        newFormatBasenamesByDir: newFormatByDir,
        requireSupersededByNewFormat: cli.requireSuperseded,
        supersedeSourceSegments: supersedeSegs ?? null,
      })
      row.created_at = o.created_at
      row.updated_at = o.updated_at
      rows.push(row)
    }

    const candidates: ProductHeroGcRow[] = []
    for (const row of rows) {
      if (tooYoung(row.created_at, cli.minAgeHours)) {
        skippedMinAge++
        logJson(cli.jsonLog, { event: 'skip_min_age', objectKey: row.objectKey, created_at: row.created_at })
        continue
      }
      if (!isGcDeletionCandidate(row, cli.requireSuperseded)) continue
      candidates.push(row)
    }

    const limit = cli.maxDelete ?? (cli.apply ? 50 : 10_000)
    const toProcess = candidates.slice(0, limit)

    console.log('\n[gc-product-hero-storage] --- summary ---')
    console.log('skipped (min-age):', skippedMinAge)
    console.log('legacy-like rows (before age filter):', rows.filter((r) => r.legacyFilename).length)
    console.log('referenced legacy (never delete):', rows.filter((r) => r.legacyFilename && r.referenced).length)
    console.log('deletion candidates:', candidates.length)
    console.log('selected for this run (max-delete):', toProcess.length)

    for (const row of toProcess.slice(0, 40)) {
      const { basename } = objectKeyDirAndBasename(row.objectKey)
      const base = basenameWithoutExtension(basename)
      console.log('  -', row.objectKey, '|', row.reasons.join(','), '| base=', base)
    }
    if (toProcess.length > 40) console.log('  ...', toProcess.length - 40, 'more')

    for (const row of toProcess) {
      logJson(cli.jsonLog, {
        event: cli.apply ? 'delete_candidate' : 'dry_run_candidate',
        objectKey: row.objectKey,
        reasons: row.reasons,
        created_at: row.created_at,
      })
    }

    if (cli.dryRun) {
      console.log('\n[gc-product-hero-storage] dry-run 완료. 삭제 없음.')
      const summaryPath = cli.jsonLog
        ? resolve(process.cwd(), cli.jsonLog.replace(/\.jsonl?$/i, '') + '-summary.json')
        : null
      if (summaryPath) {
        writeFileSync(
          summaryPath,
          JSON.stringify(
            {
              bucket,
              mode: 'dry-run',
              prefixes: cli.prefixes,
              referencedKeyCount: referenced.size,
              scannedObjects: uniqueKeys.length,
              truncated,
              skippedMinAge,
              candidateCount: candidates.length,
              selectedCount: toProcess.length,
              sample: toProcess.slice(0, 200).map((r) => r.objectKey),
            },
            null,
            2
          ),
          'utf8'
        )
        console.log('[gc-product-hero-storage] summary json:', summaryPath)
      }
      return
    }

    const keys = toProcess.map((r) => r.objectKey)
    console.log('\n[gc-product-hero-storage] deleting', keys.length, 'object(s)...')
    const result = await removeStorageObjectsBatched(keys, { batchSize: 60 })
    for (const k of result.removed) {
      logJson(cli.jsonLog, { event: 'deleted_ok', objectKey: k })
      console.log('[gc-product-hero-storage] removed:', k)
    }
    for (const f of result.failed) {
      logJson(cli.jsonLog, { event: 'deleted_fail', objectKey: f.key, error: f.message })
      console.error('[gc-product-hero-storage] FAILED:', f.key, f.message)
    }
    console.log('\n[gc-product-hero-storage] apply done. removed:', result.removed.length, 'failed:', result.failed.length)
  })()
}

main().catch((e) => {
  console.error('[gc-product-hero-storage]', e)
  process.exit(1)
})
