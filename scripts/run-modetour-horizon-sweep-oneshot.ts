/**
 * modetour registered 전체 — 미래 6개월(180일) 출발·가격 1회성 순차 sweep.
 *
 * 상품 1건 sweep 완료 → 다음 1건 (동시 처리 없음). 중단 시 `--resume` 으로 이어감.
 * SSOT: `lib/modetour-sweep` `sweepDueModetourProducts` (API → SD1 시 E2E 폴백).
 *
 * 실행:
 *   npm run db:modetour-sweep-oneshot
 *   npm run db:modetour-sweep-oneshot -- --dry-run
 *   npm run db:modetour-sweep-oneshot -- --resume
 *   npm run db:modetour-sweep-oneshot -- --from-slug pkg-mt-0100
 *
 * 상태 파일: `ops/modetour-horizon-sweep-oneshot-state.json`
 * 상품 간 대기(ms): `MODETOUR_ONESHOT_PAUSE_MS` (기본 1500)
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import { extractModetourProductNoFromPackageUrl } from '@/lib/modetour-origin-code-resolve'
import { sweepDueModetourProducts, type ModetourSweepResult } from '@/lib/modetour-sweep'
import { RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const STATE_PATH = path.join(process.cwd(), 'ops', 'modetour-horizon-sweep-oneshot-state.json')

type SweepTarget = {
  id: string
  slug: string | null
  title: string
  originCode: string | null
  productNo: string | null
  originUrl: string | null
}

type OneshotState = {
  startedAt: string
  updatedAt: string
  horizonDays: number
  total: number
  cursor: number
  completed: number
  skippedNoProductNo: number
  last?: {
    slug: string | null
    productNo: string | null
    result: ModetourSweepResult
  }
  log: Array<{
    at: string
    index: number
    slug: string | null
    productNo: string | null
    title: string
    result: ModetourSweepResult
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
  const raw = Number(process.env.MODETOUR_ONESHOT_PAUSE_MS ?? '1500')
  return Number.isFinite(raw) && raw >= 0 ? raw : 1500
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function listTargets(prisma: PrismaClient): Promise<SweepTarget[]> {
  const rows = await prisma.product.findMany({
    where: { originSource: 'modetour', registrationStatus: 'registered' },
    select: { id: true, slug: true, title: true, originUrl: true, originCode: true },
    orderBy: [{ slug: 'asc' }, { id: 'asc' }],
  })
  return rows.map((r) => ({
    ...r,
    productNo:
      parseModetourPackageProductNoFromUrl(r.originUrl) ||
      extractModetourProductNoFromPackageUrl(r.originUrl),
  }))
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
          withProductNo: targets.filter((t) => t.productNo).length,
          withOriginCode: targets.filter((t) => t.originCode?.trim()).length,
          withoutCollectKey: targets.filter((t) => !t.productNo && !t.originCode?.trim()).length,
          startIndex,
          targets: targets.map((t, i) => ({
            index: i,
            slug: t.slug,
            originCode: t.originCode,
            productNo: t.productNo,
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
    skippedNoProductNo: resume ? (loadState()?.skippedNoProductNo ?? 0) : 0,
    log: resume && loadState()?.log ? loadState()!.log : [],
  }

  console.error(
    `[oneshot] start total=${targets.length} cursor=${startIndex} horizon=${RULE_A_WINDOW_DAYS}d pauseMs=${interProductPauseMs()}`,
  )

  for (let i = startIndex; i < targets.length; i += 1) {
    const t = targets[i]
    state.cursor = i
    state.updatedAt = new Date().toISOString()

    if (!t.originCode?.trim() && !t.productNo) {
      state.skippedNoProductNo += 1
      console.error(`[oneshot] ${i + 1}/${targets.length} SKIP no originCode/productNo slug=${t.slug ?? t.id}`)
      saveState(state)
      continue
    }

    console.error(
      `[oneshot] ${i + 1}/${targets.length} sweep slug=${t.slug ?? '—'} originCode=${t.originCode ?? '—'} productNo=${t.productNo ?? '—'} title=${t.title?.slice(0, 50) ?? ''}`,
    )

    const result = await sweepDueModetourProducts(prisma, {
      productId: t.id,
      limit: 1,
    })

    state.completed += 1
    state.last = { slug: t.slug, productNo: t.productNo, result }
    state.log.push({
      at: new Date().toISOString(),
      index: i,
      slug: t.slug,
      productNo: t.productNo,
      title: t.title,
      result,
    })
    if (state.log.length > 500) state.log = state.log.slice(-500)
    state.cursor = i + 1
    saveState(state)

    console.error(
      `[oneshot] done ${i + 1}/${targets.length} processed=${result.processed} updated=${result.updated} retired=${result.retired} skipped=${result.skipped} e2eOk=${result.e2eCollected} e2eTried=${result.e2eAttempted} e2eModalFail=${result.e2eModalOpenFailed} pruned=${result.pruned}`,
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
        skippedNoProductNo: state.skippedNoProductNo,
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
