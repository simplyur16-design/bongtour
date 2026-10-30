/**
 * WORK-ORDER 8 3단계(준비) — 기존 상품 대표 사진 보충/교체 백필. 기본은 dry-run(읽기만).
 *
 *   npx tsx scripts/image-policy-backfill.ts                      # dry-run: 계획 파일만 만듦(DB 읽기만)
 *   npx tsx scripts/image-policy-backfill.ts --probe              # + 가로폭 모르는 대표 사진 앞부분만 받아 측정(1초 간격)
 *   npx tsx scripts/image-policy-backfill.ts --probe --search-pexels  # + 대상별 Pexels 후보 5장(1초 간격, 저장 안 함)
 *   IMAGE_BACKFILL_CONFIRM=YES npx tsx scripts/image-policy-backfill.ts --apply --plan plan.json --backup-dir DIR
 *      → plan 안에서 "approved": true 이고 chosen 후보가 있는 줄만 씀. 쓰기 전에 백업 JSON 먼저 저장.
 *
 * 규칙: 순서 Pexels → Unsplash/CC0 → AI(생성 표시). 기존 iStock 유지. photo_owned·manual 은 건드리지 않음.
 * 쓰는 칸: BACKFILL_WRITABLE_FIELDS(대표 사진 칸)만. 출처 기록(작가·원본링크·ID)은 만들지 않음.
 * Unsplash/CC0 검색 연동은 저장소에 없음 → 계획에 'not_integrated'로만 표시. AI 생성은 prompt 칸 결정 전까지 계획만.
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
  classifyBackfillRow,
  isBackfillPhotoTarget,
  pickBackfillWritableData,
  type BackfillProductRow,
} from '../lib/product-image-backfill-plan'
import { evaluateImageCandidatePolicy, IMAGE_MIN_WIDTH } from '../lib/product-image-source-policy'
import { probeImageDimensions } from '../lib/image-dimension-probe'
import { toHeroStorageSourceTypeSegment } from '../lib/product-hero-image-source-type'

type PlanCandidate = { tier: string; url: string; width: number; height: number; pexelsId?: number; query?: string }
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
  unsplashCc0: 'not_integrated'
  ai: 'plan_only_owner_decision'
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
      unsplashCc0: 'not_integrated',
      ai: 'plan_only_owner_decision',
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
  const { internalizeProductCoverImageUrl } = await import('../lib/travel-product-image-internalize')
  for (const it of todo) {
    const cand = it.candidates[it.chosen!]!
    const cur = before.find((b) => (b as { id: string }).id === it.id) as { bgImageUrl?: string | null } | undefined
    if ((cur?.bgImageUrl ?? null) !== it.currentUrl) {
      console.log(`건너뜀 ${it.slug}: 계획 뒤 대표 사진이 바뀜`)
      continue
    }
    const hosted = await internalizeProductCoverImageUrl(prisma, {
      remoteUrl: cand.url,
      destination: cand.query ?? 'unknown',
      poolAttractionLabel: cand.query ?? 'cover',
      poolSource: 'Pexels',
      pexelsPhotoId: null,
      photographer: null,
      pexelsPageUrl: null,
      searchKeyword: cand.query ?? null,
      placeName: null,
      cityName: null,
    })
    const dim = await probeImageDimensions(hosted)
    const data = pickBackfillWritableData({
      bgImageUrl: hosted,
      bgImageSource: cand.tier,
      bgImageSourceType: toHeroStorageSourceTypeSegment(cand.tier),
      bgImageWidth: dim?.width ?? cand.width,
      bgImageHeight: dim?.height ?? cand.height,
      bgImageIsGenerated: cand.tier === 'generated',
    })
    await prisma.product.update({ where: { id: it.id }, data })
    console.log(`썼음 ${it.slug}`)
    await sleep(BACKFILL_MIN_INTERVAL_MS)
  }
}

;(has('--apply') ? apply() : dryRun())
  .catch((e) => {
    console.error('ERROR', e instanceof Error ? e.message.replace(/postgres(ql)?:\/\/\S+/g, '[redacted]') : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
