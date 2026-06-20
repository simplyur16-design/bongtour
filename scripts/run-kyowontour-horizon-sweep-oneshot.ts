/**
 * kyowontour registered 전체 — 미래 180일 출발·가격 1회성 순차 sweep.
 *
 *   npm run db:kyowontour-sweep-oneshot
 *   npm run db:kyowontour-sweep-oneshot -- --product-id <uuid>
 *
 * 상태: `ops/kyowontour-horizon-sweep-oneshot-state.json`
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { sweepDueKyowontourProducts, type KyowontourSweepResult } from '@/lib/kyowontour-sweep'

const STATE_PATH = path.join(process.cwd(), 'ops', 'kyowontour-horizon-sweep-oneshot-state.json')

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

async function main() {
  const productId = readArg('--product-id')
  const prisma = new PrismaClient()
  try {
    const result: KyowontourSweepResult = await sweepDueKyowontourProducts(prisma, {
      limit: productId ? 1 : 500,
      productId,
    })
    const out = {
      finishedAt: new Date().toISOString(),
      horizonDays: RULE_A_WINDOW_DAYS,
      productId,
      result,
    }
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
    fs.writeFileSync(STATE_PATH, JSON.stringify(out, null, 2), 'utf8')
    console.log(JSON.stringify({ ok: true, outFile: STATE_PATH, result }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
