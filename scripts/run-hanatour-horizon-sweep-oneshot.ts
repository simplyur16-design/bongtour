/**
 * hanatour registered 전체 — 미래 6개월(180일) 출발·가격 1회성 순차 sweep.
 *
 * 상품 1건 sweep 완료 → 다음 1건 (동시 처리 없음). 중단 시 `--resume` 으로 이어감.
 * SSOT: `lib/hanatour-sweep` `sweepDueHanatourProducts` (API → E2E 폴백).
 *
 * 실행:
 *   npm run db:hanatour-sweep-oneshot
 *   npm run db:hanatour-sweep-oneshot -- --dry-run
 *   npm run db:hanatour-sweep-oneshot -- --resume
 *   npm run db:hanatour-sweep-oneshot -- --from-slug pkg-ht-0001
 *
 * 상태 파일: `ops/hanatour-horizon-sweep-oneshot-state.json`
 * 상품 간 대기(ms): `HANATOUR_ONESHOT_PAUSE_MS` (기본 1500)
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { sweepDueHanatourProducts, type HanatourSweepResult } from '@/lib/hanatour-sweep'
import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import { RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const STATE_PATH = path.join(process.cwd(), 'ops', 'hanatour-horizon-sweep-oneshot-state.json')

type SweepTarget = {
  id: string
  slug: string | null
  title: string
  originCode: string | null
  pkgCd: string | null
  originUrl: string | null
}

type OneshotState = {
  startedAt: string
  updatedAt: string
  horizonDays: number
  total: number
  cursor: number
  completed: number
  skippedNoUrl: number
  last?: {
    slug: string | null
    pkgCd: string | null
    result: HanatourSweepResult
  }
  log: Array<{
    at: string
    index: number
    slug: string | null
    pkgCd: string | null
    title: string
    result: HanatourSweepResult
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
  const raw = Number(process.env.HANATOUR_ONESHOT_PAUSE_MS ?? '1500')
  return Number.isFinite(raw) && raw >= 0 ? raw : 1500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function listTargets(prisma: PrismaClient): Promise<SweepTarget[]> {
  const rows = await prisma.product.findMany({
    where: { originSource: 'hanatour', registrationStatus: 'registered' },
    select: { id: true, slug: true, title: true, originUrl: true, originCode: true },
    orderBy: [{ slug: 'asc' }, { id: 'asc' }],
  })
  return rows.map((r) => ({
    ...r,
    pkgCd: parseHanatourPkgCdFromUrl(r.originUrl ?? '') ?? null,
  }))
}

async function main() {
  if (!(process.env.HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH ?? '').trim()) {
    process.env.HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH = '180000'
    console.error(
      '[oneshot] E2E per-month timeout=180000ms (override: HANATOUR_PYTHON_TIMEOUT_MS_PER_MONTH)',
    )
  }

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
          withPkgCd: targets.filter((t) => t.pkgCd).length,
          withOriginCode: targets.filter((t) => t.originCode?.trim()).length,
          withoutCollectKey: targets.filter((t) => !t.pkgCd && !t.originCode?.trim()).length,
          startIndex,
          targets: targets.map((t, i) => ({
            index: i,
            slug: t.slug,
            originCode: t.originCode,
            pkgCd: t.pkgCd,
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
    skippedNoUrl: resume ? (loadState()?.skippedNoUrl ?? 0) : 0,
    log: resume && loadState()?.log ? loadState()!.log : [],
  }

  console.error(
    `[oneshot] start total=${targets.length} cursor=${startIndex} horizon=${RULE_A_WINDOW_DAYS}d pauseMs=${interProductPauseMs()}`,
  )

  for (let i = startIndex; i < targets.length; i += 1) {
    const t = targets[i]!
    state.cursor = i
    state.updatedAt = new Date().toISOString()

    const hasUrl = (t.originUrl ?? '').trim().startsWith('http') || (t.originCode ?? '').trim()
    if (!hasUrl) {
      state.skippedNoUrl += 1
      console.error(`[oneshot] ${i + 1}/${targets.length} SKIP no originUrl/originCode slug=${t.slug ?? t.id}`)
      saveState(state)
      continue
    }

    console.error(
      `[oneshot] ${i + 1}/${targets.length} sweep slug=${t.slug ?? '—'} pkgCd=${t.pkgCd ?? '—'} title=${t.title?.slice(0, 50) ?? ''}`,
    )

    const result = await sweepDueHanatourProducts(prisma, {
      productId: t.id,
      limit: 1,
    })

    state.completed += 1
    state.last = { slug: t.slug, pkgCd: t.pkgCd, result }
    state.log.push({
      at: new Date().toISOString(),
      index: i,
      slug: t.slug,
      pkgCd: t.pkgCd,
      title: t.title,
      result,
    })
    if (state.log.length > 500) state.log = state.log.slice(-500)
    state.cursor = i + 1
    saveState(state)

    console.error(
      `[oneshot] done ${i + 1}/${targets.length} processed=${result.processed} updated=${result.updated} skipped=${result.skipped} e2eOk=${result.e2eCollected} e2eTried=${result.e2eAttempted} pruned=${result.pruned} urgentOn=${result.urgentDealOn}`,
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
        skippedNoUrl: state.skippedNoUrl,
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
