/**
 * WORK-ORDER 8 3단계(준비) — 기존 상품 대표 사진 보충/교체 백필. 기본은 dry-run(읽기만).
 *
 *   npx tsx scripts/image-policy-backfill.ts                      # dry-run: 계획 파일만 만듦(DB 읽기만)
 *   npx tsx scripts/image-policy-backfill.ts --probe              # + 가로폭 모르는 대표 사진 앞부분만 받아 측정(1초 간격)
 *   npx tsx scripts/image-policy-backfill.ts --probe --search-pexels  # + 대상별 Pexels 후보 5장(1초 간격, 저장 안 함)
 *   IMAGE_BACKFILL_CONFIRM=YES npx tsx scripts/image-policy-backfill.ts --apply --plan plan.json --backup-dir DIR
 *      → plan 안에서 "approved": true 이고 chosen 후보가 있는 줄만 씀. 쓰기 전에 백업 JSON 먼저 저장.
 *
 *   공개 중 상품 교체(사장님 10/30 19:34 "배포 뒤 50개씩 문과장 검수 받고 바꿔"):
 *   npx tsx scripts/image-policy-backfill.ts --live --batch 1 [--batch-size 50] [--batch-dir DIR]
 *      → dry-run(읽기만): 공개 중 replace_cover 대상을 50개씩 나눠 N번째 배치의 검수 파일(batch-NN-review.json/.csv)만 만듦.
 *        후보: Pexels → Unsplash(UNSPLASH_ACCESS_KEY 있을 때만) → 없으면 'none'(AI 자동 생성 안 함). 1초 간격.
 *   IMAGE_BACKFILL_CONFIRM=YES npx tsx scripts/image-policy-backfill.ts --live --apply-batch 1 --batch-dir DIR --backup-dir DIR
 *      → batch-NN-approved.json(문과장 승인, 검수 파일 sha256 일치) 이 있을 때만, 승인 줄만 씀. 백업 먼저.
 *        Pexels = 기존처럼 Ncloud 재호스팅, Unsplash = API 주소 핫링크 + download_location 호출(가이드라인).
 *
 * 규칙: 순서 Pexels → Unsplash/CC0 → AI(생성 표시). 기존 iStock·자체 사진 7장 유지.
 * 쓰는 칸: BACKFILL_WRITABLE_FIELDS(대표 사진 칸)만. 출처 기록(작가·원본링크·ID)은 만들지 않음. 가격 칸 읽기·쓰기 없음.
 * 키(PEXELS_API_KEY·UNSPLASH_ACCESS_KEY)는 절대 출력하지 않음. AI 생성은 계획만(실제 prompt 없으면 지어내지 않음).
 * REGRESSION-FREEZE[product-image-backfill-plan]: 기본 dry-run·백업 먼저·이미지 칸만 — manifest
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import {
  BACKFILL_BACKUP_FIELDS,
  BACKFILL_MIN_INTERVAL_MS,
  BACKFILL_SOURCE_ORDER,
  LIVE_REPLACE_BATCH_SIZE,
  batchFileNames,
  batchReviewCsv,
  buildBatchReviewRow,
  checkApprovedBatch,
  classifyBackfillRow,
  isBackfillPhotoTarget,
  pickBackfillWritableData,
  splitIntoBatches,
  type BackfillProductRow,
  type BatchApprovedFile,
  type BatchProposal,
  type BatchReviewFile,
  type BatchReviewRow,
  type BatchTarget,
  backfillCreditFieldsFor,
} from '../lib/product-image-backfill-plan'
import { publicProductWhereClause } from '../lib/product-sales-policy'
import { OVERSEAS_TRAINING_LISTING_KIND } from '../lib/overseas-training-program-query'
import { isUnsplashConfigured, searchUnsplashHeroCandidates, triggerUnsplashDownload } from '../lib/unsplash-service'
import { evaluateImageCandidatePolicy, IMAGE_MIN_WIDTH } from '../lib/product-image-source-policy'
import { probeImageDimensions } from '../lib/image-dimension-probe'
import { toHeroStorageSourceTypeSegment } from '../lib/product-hero-image-source-type'

type PlanCandidate = {
  tier: string
  url: string
  width: number
  height: number
  pexelsId?: number
  query?: string
  /** Unsplash: 확정 시 호출(가이드라인), DB 저장 안 함 */
  downloadLocation?: string
  /** Unsplash 크레딧(작가 이름·프로필·사진 ID) — 확정 시 기존 칸에 기록 */
  unsplashId?: string
  authorName?: string | null
  authorProfileUrl?: string | null
}
type PlanItem = {
  id: string
  slug: string | null
  registrationStatus: string | null
  action: string
  fails: string[]
  currentUrl: string | null
  measuredWidth: number | null
  sourceOrder: readonly string[]
  candidates: PlanCandidate[]
  unsplash: 'searched' | 'not_searched' | 'disabled_no_env'
  ai: 'plan_only_no_auto_generate'
  approved: boolean
  chosen: number | null
}

function arg(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}
const has = (n: string) => process.argv.includes(n)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function dryRun() {
  const out = arg('--out') ?? path.join(process.cwd(), `image-backfill-plan-${Date.now()}.json`)
  const limit = Number(arg('--limit') ?? '0') || undefined
  const rows = (await prisma.product.findMany({
    select: {
      id: true,
      slug: true,
      registrationStatus: true,
      destination: true,
      title: true,
      bgImageUrl: true,
      bgImageSource: true,
      bgImageSourceUrl: true,
      bgImagePhotographer: true,
      bgImageWidth: true,
      bgImageIsGenerated: true,
    },
    take: limit,
    orderBy: { id: 'asc' },
  })) as Array<BackfillProductRow & { destination: string | null; title: string | null }>
  const items: PlanItem[] = []
  let lastNet = 0
  const polite = async () => {
    const wait = lastNet + BACKFILL_MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastNet = Date.now()
  }
  for (const r of rows) {
    let measured: number | null = null
    if (has('--probe') && r.bgImageUrl && !(r.bgImageWidth && r.bgImageWidth > 0)) {
      await polite()
      measured = (await probeImageDimensions(r.bgImageUrl))?.width ?? null
    }
    const c = classifyBackfillRow(r, measured)
    const item: PlanItem = {
      id: r.id,
      slug: r.slug,
      registrationStatus: r.registrationStatus,
      action: c.action,
      fails: [...c.fails],
      currentUrl: r.bgImageUrl,
      measuredWidth: measured,
      sourceOrder: BACKFILL_SOURCE_ORDER,
      candidates: [],
      unsplash: isUnsplashConfigured() ? (has('--search-unsplash') ? 'searched' : 'not_searched') : 'disabled_no_env',
      ai: 'plan_only_no_auto_generate',
      approved: false,
      chosen: null,
    }
    if (has('--search-pexels') && isBackfillPhotoTarget(c.action)) {
      const { searchPexelsHeroCandidates } = await import('../lib/pexels-service')
      const q = (r.destination ?? '').split(',')[0]?.trim() || (r.title ?? '').slice(0, 40)
      if (q) {
        await polite()
        const got = await searchPexelsHeroCandidates(`${q} landmark`, 5, q)
        for (const g of got) {
          const ok = evaluateImageCandidatePolicy({ source: 'pexels', url: g.imageUrl, width: g.width }).pass
          if (ok && g.width >= IMAGE_MIN_WIDTH) {
            item.candidates.push({ tier: 'pexels', url: g.imageUrl, width: g.width, height: g.height, pexelsId: g.pexelsId, query: q })
          }
        }
      }
    }
    if (has('--search-unsplash') && isUnsplashConfigured() && isBackfillPhotoTarget(c.action) && item.candidates.length === 0) {
      const q = (r.destination ?? '').split(',')[0]?.trim() || (r.title ?? '').slice(0, 40)
      if (q) {
        await polite()
        for (const g of await searchUnsplashHeroCandidates(`${q} landmark`, 5, q)) {
          if (evaluateImageCandidatePolicy({ source: 'unsplash', url: g.imageUrl, width: g.width, photographer: g.authorName, authorProfileUrl: g.authorProfileUrl }).pass) {
            item.candidates.push({ tier: 'unsplash', url: g.imageUrl, width: g.width, height: g.height, query: q, downloadLocation: g.downloadLocation, unsplashId: g.unsplashId, authorName: g.authorName, authorProfileUrl: g.authorProfileUrl })
          }
        }
      }
    }
    items.push(item)
  }
  fs.writeFileSync(out, JSON.stringify({ mode: 'dry-run', at: new Date().toISOString(), items }, null, 2))
  const by: Record<string, Record<string, number>> = {}
  for (const it of items) {
    const s = it.registrationStatus ?? 'pending'
    by[it.action] = by[it.action] ?? {}
    by[it.action]![s] = (by[it.action]![s] ?? 0) + 1
  }
  console.log(JSON.stringify({ mode: 'dry-run', total: items.length, byActionAndStatus: by, plan: out }))
}

async function apply() {
  if ((process.env.IMAGE_BACKFILL_CONFIRM ?? '') !== 'YES') throw new Error('IMAGE_BACKFILL_CONFIRM=YES 가 없어 쓰지 않습니다.')
  const planPath = arg('--plan')
  const backupDir = arg('--backup-dir')
  if (!planPath || !backupDir) throw new Error('--plan 과 --backup-dir 가 필요합니다.')
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8')) as { items: PlanItem[] }
  const todo = plan.items.filter(
    (it) => it.approved === true && isBackfillPhotoTarget(it.action as never) && it.chosen != null && it.candidates[it.chosen]
  )
  if (todo.length === 0) {
    console.log('승인된 줄 없음 — 쓰기 없음')
    return
  }
  const select = Object.fromEntries(BACKFILL_BACKUP_FIELDS.map((k) => [k, true]))
  const before = await prisma.product.findMany({ where: { id: { in: todo.map((t) => t.id) } }, select })
  fs.mkdirSync(backupDir, { recursive: true })
  const backupFile = path.join(backupDir, `image-backfill-backup-${Date.now()}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(before, null, 2))
  if (!fs.existsSync(backupFile) || fs.statSync(backupFile).size < 2) throw new Error('백업 저장 실패 — 중단')
  console.log(`백업 ${before.length}건 → ${backupFile}`)
  for (const it of todo) {
    const cand = it.candidates[it.chosen!]!
    const cur = before.find((b) => (b as { id: string }).id === it.id) as { bgImageUrl?: string | null } | undefined
    if ((cur?.bgImageUrl ?? null) !== it.currentUrl) {
      console.log(`건너뜀 ${it.slug}: 계획 뒤 대표 사진이 바뀜`)
      continue
    }
    const hosted = await hostChosenCover(cand.tier, cand.url, cand.query ?? null, cand.downloadLocation ?? null)
    if (!hosted) {
      console.log(`건너뜀 ${it.slug}: 사진 확정 실패`)
      continue
    }
    const dim = await probeImageDimensions(hosted)
    const data = pickBackfillWritableData({
      bgImageUrl: hosted,
      bgImageSource: cand.tier,
      bgImageSourceType: toHeroStorageSourceTypeSegment(cand.tier),
      bgImageWidth: dim?.width ?? cand.width,
      bgImageHeight: dim?.height ?? cand.height,
      bgImageIsGenerated: false,
      ...backfillCreditFieldsFor({ source: cand.tier, unsplashId: cand.unsplashId, unsplashAuthorName: cand.authorName, unsplashAuthorProfileUrl: cand.authorProfileUrl }),
    })
    await prisma.product.update({ where: { id: it.id }, data })
    console.log(`썼음 ${it.slug}`)
    await sleep(BACKFILL_MIN_INTERVAL_MS)
  }
}

/** Pexels → Ncloud 재호스팅(기존 경로). Unsplash → 가이드라인대로 API 주소 핫링크 + download_location 호출. */
async function hostChosenCover(tier: string, url: string, query: string | null, downloadLocation: string | null): Promise<string | null> {
  if (tier === 'unsplash') {
    if (!downloadLocation) return null
    const ok = await triggerUnsplashDownload(downloadLocation)
    return ok ? url : null
  }
  if (tier !== 'pexels') return null
  const { internalizeProductCoverImageUrl } = await import('../lib/travel-product-image-internalize')
  return internalizeProductCoverImageUrl(prisma, {
    remoteUrl: url,
    destination: query ?? 'unknown',
    poolAttractionLabel: query ?? 'cover',
    poolSource: 'Pexels',
    pexelsPhotoId: null,
    photographer: null,
    pexelsPageUrl: null,
    searchKeyword: query,
    placeName: null,
    cityName: null,
  })
}


/* ───────────── 공개 중 상품 교체: 50개씩 배치 ───────────── */

const DEFAULT_BATCH_DIR = '/workspace/live/image-batches-1030'

function batchSize(): number {
  const n = Number(arg('--batch-size') ?? String(LIVE_REPLACE_BATCH_SIZE))
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : LIVE_REPLACE_BATCH_SIZE
}

/** 공개 중 = sitemap 과 같은 조건(등록완료 + 해외 + 공개 판매 조건, 연수 제외). 가격 칸은 select 하지 않음. */
async function loadLiveReplaceTargets(): Promise<Array<BatchTarget & { destination: string | null }>> {
  const rows = (await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: 'overseas',
      AND: [publicProductWhereClause()],
      NOT: { listingKind: OVERSEAS_TRAINING_LISTING_KIND },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      destination: true,
      registrationStatus: true,
      bgImageUrl: true,
      bgImageSource: true,
      bgImageSourceUrl: true,
      bgImagePhotographer: true,
      bgImageWidth: true,
      bgImageIsGenerated: true,
    },
    orderBy: { id: 'asc' },
  })) as Array<BackfillProductRow & { title: string | null; destination: string | null }>
  const out: Array<BatchTarget & { destination: string | null }> = []
  let lastProbe = 0
  for (const r of rows) {
    let measured: number | null = null
    // DB에 가로폭이 없으면 파일 앞부분만 받아 측정(1초 간격, 쓰기 없음) — 없으면 measure_width 로 빠져 대상에서 누락됨
    if (r.bgImageUrl && !(r.bgImageWidth && r.bgImageWidth > 0)) {
      const wait = lastProbe + BACKFILL_MIN_INTERVAL_MS - Date.now()
      if (wait > 0) await sleep(wait)
      lastProbe = Date.now()
      measured = (await probeImageDimensions(r.bgImageUrl))?.width ?? null
    }
    if (classifyBackfillRow(r, measured).action !== 'replace_cover') continue
    out.push({ productId: r.id, slug: r.slug, title: r.title, currentUrl: r.bgImageUrl, currentWidth: r.bgImageWidth ?? measured, destination: r.destination })
  }
  return out
}

/** used: 이미 이 배치(또는 공개 상품)에 쓰인 주소 — 같은 사진을 여러 상품에 주지 않음(M4-DUP 방지) */
async function proposeFor(
  t: BatchTarget & { destination: string | null },
  polite: () => Promise<void>,
  used: Set<string>
): Promise<BatchProposal> {
  const q = (t.destination ?? '').split(',')[0]?.trim() || (t.title ?? '').slice(0, 40)
  if (!q) return { source: 'none', url: null, width: null, height: null, query: null }
  const { searchPexelsHeroCandidates } = await import('../lib/pexels-service')
  await polite()
  for (const g of await searchPexelsHeroCandidates(`${q} landmark`, 5, q)) {
    if (!used.has(g.imageUrl) && evaluateImageCandidatePolicy({ source: 'pexels', url: g.imageUrl, width: g.width }).pass) {
      used.add(g.imageUrl)
      return { source: 'pexels', url: g.imageUrl, width: g.width, height: g.height, query: q }
    }
  }
  if (isUnsplashConfigured()) {
    await polite()
    for (const g of await searchUnsplashHeroCandidates(`${q} landmark`, 5, q)) {
      if (!used.has(g.imageUrl) && evaluateImageCandidatePolicy({ source: 'unsplash', url: g.imageUrl, width: g.width, photographer: g.authorName, authorProfileUrl: g.authorProfileUrl }).pass) {
        used.add(g.imageUrl)
        return {
          source: 'unsplash',
          url: g.imageUrl,
          width: g.width,
          height: g.height,
          unsplashDownloadLocation: g.downloadLocation,
          unsplashId: g.unsplashId,
          unsplashAuthorName: g.authorName,
          unsplashAuthorProfileUrl: g.authorProfileUrl,
          query: q,
        }
      }
    }
  }
  return { source: 'none', url: null, width: null, height: null, query: q }
}

async function batchPreview(batch: number) {
  const dir = arg('--batch-dir') ?? DEFAULT_BATCH_DIR
  const size = batchSize()
  const targets = await loadLiveReplaceTargets()
  const batches = splitIntoBatches(targets, size)
  const cur = batches[batch - 1]
  if (!cur) throw new Error(`배치 ${batch} 없음 (전체 ${targets.length}개, ${batches.length}배치)`)
  let lastNet = 0
  const polite = async () => {
    const wait = lastNet + BACKFILL_MIN_INTERVAL_MS - Date.now()
    if (wait > 0) await sleep(wait)
    lastNet = Date.now()
  }
  const rows: BatchReviewRow[] = []
  const used = new Set<string>()
  for (const t of cur) rows.push(buildBatchReviewRow(t, await proposeFor(t, polite, used)))
  const review: BatchReviewFile = {
    kind: 'image-live-replace-review',
    batch,
    batchSize: size,
    totalTargets: targets.length,
    generatedAt: new Date().toISOString(),
    mode: 'dry-run',
    rows,
  }
  const names = batchFileNames(batch)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, names.review), JSON.stringify(review, null, 2))
  fs.writeFileSync(path.join(dir, names.reviewCsv), batchReviewCsv(rows))
  const bySrc: Record<string, number> = {}
  for (const r of rows) bySrc[r.proposedSource] = (bySrc[r.proposedSource] ?? 0) + 1
  console.log(JSON.stringify({ mode: 'dry-run', batch, rows: rows.length, totalTargets: targets.length, batches: batches.length, bySource: bySrc, review: path.join(dir, names.review) }))
}

async function applyBatch(batch: number) {
  if ((process.env.IMAGE_BACKFILL_CONFIRM ?? '') !== 'YES') throw new Error('IMAGE_BACKFILL_CONFIRM=YES 가 없어 쓰지 않습니다.')
  const dir = arg('--batch-dir') ?? DEFAULT_BATCH_DIR
  const backupDir = arg('--backup-dir')
  if (!backupDir) throw new Error('--backup-dir 가 필요합니다.')
  const names = batchFileNames(batch)
  const reviewPath = path.join(dir, names.review)
  const approvedPath = path.join(dir, names.approved)
  if (!fs.existsSync(reviewPath)) throw new Error(`검수 파일 없음: ${names.review} — 쓰지 않음`)
  const reviewText = fs.readFileSync(reviewPath, 'utf8')
  const approved = fs.existsSync(approvedPath) ? (JSON.parse(fs.readFileSync(approvedPath, 'utf8')) as BatchApprovedFile) : null
  const chk = checkApprovedBatch(reviewText, approved, batch)
  if (!chk.ok) throw new Error(`문과장 승인 파일 확인 실패(${chk.reason}) — 쓰지 않음`)
  const select = Object.fromEntries(BACKFILL_BACKUP_FIELDS.map((k) => [k, true]))
  const before = await prisma.product.findMany({ where: { id: { in: chk.approvedRows.map((r) => r.productId) } }, select })
  fs.mkdirSync(backupDir, { recursive: true })
  const backupFile = path.join(backupDir, `image-live-batch-${String(batch).padStart(2, '0')}-backup-${Date.now()}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(before, null, 2))
  if (!fs.existsSync(backupFile) || fs.statSync(backupFile).size < 2) throw new Error('백업 저장 실패 — 중단')
  console.log(`백업 ${before.length}건 → ${backupFile}`)
  let wrote = 0
  for (const r of chk.approvedRows) {
    const cur = before.find((b) => (b as { id: string }).id === r.productId) as { bgImageUrl?: string | null } | undefined
    if ((cur?.bgImageUrl ?? null) !== r.currentImageUrl) {
      console.log(`건너뜀 ${r.slug}: 검수 뒤 대표 사진이 바뀜`)
      continue
    }
    const hosted = await hostChosenCover(r.proposedSource, r.proposedImageUrl!, r.query ?? null, r.unsplashDownloadLocation ?? null)
    if (!hosted) {
      console.log(`건너뜀 ${r.slug}: 사진 확정 실패`)
      continue
    }
    const dim = await probeImageDimensions(hosted)
    const data = pickBackfillWritableData({
      bgImageUrl: hosted,
      bgImageSource: r.proposedSource,
      bgImageSourceType: toHeroStorageSourceTypeSegment(r.proposedSource),
      bgImageWidth: dim?.width ?? r.proposedWidth,
      bgImageHeight: dim?.height ?? r.proposedHeight,
      bgImageIsGenerated: false,
      ...backfillCreditFieldsFor({ source: r.proposedSource, unsplashId: r.unsplashId, unsplashAuthorName: r.unsplashAuthorName, unsplashAuthorProfileUrl: r.unsplashAuthorProfileUrl }),
    })
    await prisma.product.update({ where: { id: r.productId }, data })
    wrote++
    console.log(`썼음 ${r.slug}`)
    await sleep(BACKFILL_MIN_INTERVAL_MS)
  }
  console.log(JSON.stringify({ batch, approved: chk.approvedRows.length, wrote }))
}

function main(): Promise<void> {
  const ab = arg('--apply-batch')
  if (ab) return applyBatch(Number(ab))
  const b = arg('--batch')
  if (b || has('--live')) return batchPreview(Number(b ?? '1') || 1)
  return has('--apply') ? apply() : dryRun()
}

;main()
  .catch((e) => {
    console.error('ERROR', e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/\S+/g, '[redacted]') : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
