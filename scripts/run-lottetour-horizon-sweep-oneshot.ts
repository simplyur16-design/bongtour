/**
 * lottetour registered 전체 — 미래 180일 출발·가격 1회성 순차 sweep.
 *
 * SSOT: `lib/lottetour-sweep` `sweepDueLottetourProducts` (evtListAjax HXR → E2E 폴백).
 *
 *   npm run db:lottetour-sweep-oneshot
 *   npm run db:lottetour-sweep-oneshot -- --dry-run
 *   npm run db:lottetour-sweep-oneshot -- --resume
 *   npm run db:lottetour-sweep-oneshot -- --from-slug pkg-lt-0001
 *
 * 상태: `ops/lottetour-horizon-sweep-oneshot-state.json`
 * 상품 간 대기: `LOTTETOUR_ONESHOT_PAUSE_MS` (기본 2500)
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { sweepDueLottetourProducts, type LottetourSweepResult } from '@/lib/lottetour-sweep'
import { RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const STATE_PATH = path.join(process.cwd(), 'ops', 'lottetour-horizon-sweep-oneshot-state.json')

type SweepTarget = {
  id: string
  slug: string | null
  title: string
  originCode: string | null
  originUrl: string | null
}

type OneshotState = {
  startedAt: string
  updatedAt: string
  horizonDays: number
  total: number
  cursor: number
  completed: number
  skippedNoHints: number
  last?: {
    slug: string | null
    originCode: string | null
    result: LottetourSweepResult
  }
  log: Array<{
    at: string
    index: number
    slug: string | null
    originCode: string | null
    title: string
    result: LottetourSweepResult
  }>
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

function loadState(): OneshotState | null {
  if (!fs.existsSync(STATE_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as OneshotState
  } catch {
    return null
  }
}

function saveState(state: OneshotState): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8')
}

function interProductPauseMs(): number {
  const raw = Number(process.env.LOTTETOUR_ONESHOT_PAUSE_MS ?? '2500')
  return Number.isFinite(raw) && raw >= 0 ? raw : 2500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function listTargets(prisma: PrismaClient): Promise<SweepTarget[]> {
  return prisma.product.findMany({
    where: { originSource: 'lottetour', registrationStatus: 'registered' },
    select: { id: true, slug: true, title: true, originUrl: true, originCode: true },
    orderBy: [{ slug: 'asc' }, { id: 'asc' }],
  })
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const resume = process.argv.includes('--resume')
  const fromSlug = readArg('--from-slug')

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  const targets = await listTargets(prisma)
  let startIndex = 0

  if (fromSlug) {
    const idx = targets.findIndex((t) => t.slug === fromSlug)
    if (idx < 0) {
      console.error(`[oneshot] slug not found: ${fromSlug}`)
      process.exit(1)
    }
    startIndex = idx
  } else if (resume) {
    const prev = loadState()
    if (prev && prev.cursor > 0 && prev.cursor < prev.total) {
      startIndex = prev.cursor
      console.error(`[oneshot] resume cursor=${startIndex}/${prev.total}`)
    }
  }

  if (dryRun) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          horizonDays: RULE_A_WINDOW_DAYS,
          total: targets.length,
          withOriginUrl: targets.filter((t) => (t.originUrl ?? '').trim().startsWith('http')).length,
          withOriginCode: targets.filter((t) => t.originCode?.trim()).length,
          startIndex,
          targets: targets.map((t, i) => ({
            index: i,
            slug: t.slug,
            originCode: t.originCode,
            title: t.title?.slice(0, 80),
          })),
        },
        null,
        2,
      ),
    )
    await prisma.$disconnect()
    return
  }

  const state: OneshotState = {
    startedAt: resume && loadState()?.startedAt ? loadState()!.startedAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    horizonDays: RULE_A_WINDOW_DAYS,
    total: targets.length,
    cursor: startIndex,
    completed: resume ? (loadState()?.completed ?? 0) : 0,
    skippedNoHints: resume ? (loadState()?.skippedNoHints ?? 0) : 0,
    log: resume && loadState()?.log ? loadState()!.log : [],
  }

  console.error(
    `[oneshot] start total=${targets.length} cursor=${startIndex} horizon=${RULE_A_WINDOW_DAYS}d pauseMs=${interProductPauseMs()}`,
  )

  for (let i = startIndex; i < targets.length; i += 1) {
    const t = targets[i]!
    state.cursor = i
    state.updatedAt = new Date().toISOString()

    const hasHints =
      (t.originUrl ?? '').trim().startsWith('http') || Boolean((t.originCode ?? '').trim())
    if (!hasHints) {
      state.skippedNoHints += 1
      console.error(`[oneshot] ${i + 1}/${targets.length} SKIP no hints slug=${t.slug ?? t.id}`)
      saveState(state)
      continue
    }

    console.error(
      `[oneshot] ${i + 1}/${targets.length} sweep slug=${t.slug ?? '—'} code=${t.originCode ?? '—'} title=${t.title?.slice(0, 50) ?? ''}`,
    )

    const result = await sweepDueLottetourProducts(prisma, {
      productId: t.id,
      limit: 1,
    })

    state.completed += 1
    state.last = { slug: t.slug, originCode: t.originCode, result }
    state.log.push({
      at: new Date().toISOString(),
      index: i,
      slug: t.slug,
      originCode: t.originCode,
      title: t.title,
      result,
    })
    if (state.log.length > 500) state.log = state.log.slice(-500)
    state.cursor = i + 1
    saveState(state)

    console.error(
      `[oneshot] done ${i + 1}/${targets.length} processed=${result.processed} updated=${result.updated} skipped=${result.skipped} soldOut=${result.horizonSoldOut} e2eOk=${result.e2eCollected} e2eTried=${result.e2eAttempted} pruned=${result.pruned}`,
    )

    if (i + 1 < targets.length && interProductPauseMs() > 0) {
      await sleep(interProductPauseMs())
    }
  }

  state.updatedAt = new Date().toISOString()
  saveState(state)

  console.log(
    JSON.stringify(
      {
        ok: true,
        finishedAt: state.updatedAt,
        horizonDays: RULE_A_WINDOW_DAYS,
        total: state.total,
        completed: state.completed,
        skippedNoHints: state.skippedNoHints,
        stateFile: STATE_PATH,
      },
      null,
      2,
    ),
  )

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
