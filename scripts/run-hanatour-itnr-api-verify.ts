/**
 * hanatour gw 일정 API live 검증 — getPkgProdItnrInfo (가격 sweep과 별도).
 *
 *   npm run verify:hanatour-itnr-api
 *   npm run verify:hanatour-itnr-api -- --pkgCd ATP207260601TWJ
 *
 * 결과: ops/hanatour-itnr-api-verify.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import { parseHanatourPkgCdFromUrl } from '@/lib/hanatour-api-departures'
import { collectHanatourRegisterFacts } from '@/lib/register-facts/hanatour'

const OUT_PATH = path.join(process.cwd(), 'ops', 'hanatour-itnr-api-verify.json')

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

async function main() {
  const pkgArg = readArg('--pkgCd')
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  let targets: Array<{ pkgCd: string; slug: string | null; originUrl: string | null }> = []

  if (pkgArg) {
    targets = [{ pkgCd: pkgArg, slug: null, originUrl: null }]
  } else if ((process.env.DATABASE_URL ?? '').trim()) {
    const rows = await prisma.product.findMany({
      where: { originSource: 'hanatour', registrationStatus: 'registered' },
      select: { slug: true, originUrl: true, originCode: true },
      take: 10,
      orderBy: [{ slug: 'asc' }],
    })
    targets = rows
      .map((r) => {
        const pkgCd =
          (parseHanatourPkgCdFromUrl(r.originUrl ?? '') ?? (r.originCode ?? '').trim()) || null
        return pkgCd ? { pkgCd, slug: r.slug, originUrl: r.originUrl } : null
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
  }

  if (targets.length === 0) {
    targets = [{ pkgCd: 'ATP207260601TWJ', slug: 'probe', originUrl: null }]
  }

  const items = []
  for (const t of targets) {
    const url =
      t.originUrl ??
      `https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=${encodeURIComponent(t.pkgCd)}`
    const t0 = Date.now()
    const facts = await collectHanatourRegisterFacts(url)
    const elapsedMs = Date.now() - t0
    items.push({
      pkgCd: t.pkgCd,
      slug: t.slug,
      ok: Boolean(facts && facts.scheduleDays.length > 0),
      scheduleDayCount: facts?.scheduleDays.length ?? 0,
      placeCount: facts?.scheduleDays.reduce((n, d) => n + d.places.length, 0) ?? 0,
      samplePlaces: facts?.scheduleDays.flatMap((d) => d.places).slice(0, 5) ?? [],
      meetingInfo: facts?.meetingInfo?.slice(0, 120) ?? null,
      title: facts?.title?.slice(0, 80) ?? null,
      elapsedMs,
      notes: facts?.notes ?? [],
    })
  }

  const summary = {
    finishedAt: new Date().toISOString(),
    api: 'POST /package/pkg/api/common/pkgcomprod/getPkgProdItnrInfo/v1.00',
    total: items.length,
    ok: items.filter((i) => i.ok).length,
    items,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(JSON.stringify({ ...summary, outFile: OUT_PATH }, null, 2))
  await prisma.$disconnect()
  if (summary.ok === 0) process.exit(1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
