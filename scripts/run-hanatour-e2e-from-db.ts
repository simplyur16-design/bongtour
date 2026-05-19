import './load-env-for-scripts'

/**
 * 하나투어 E2E — DB 상품 검증 + originUrl 감사 (통합 러너).
 *
 *   npx tsx scripts/run-hanatour-e2e-from-db.ts
 *   npx tsx scripts/run-hanatour-e2e-from-db.ts --limit 5
 *   npx tsx scripts/run-hanatour-e2e-from-db.ts --audit-urls
 *
 * Python SSOT: `python -m scripts.calendar_e2e_scraper_hanatour.main --batch`
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { normalizeSupplierOrigin } from '../lib/normalize-supplier-origin'

const HANATOUR_TRP_BASE = 'https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200'

function pkgCdFromHanatourUrl(url: string): string | null {
  const m = url.match(/[?&]pkgCd=([^&]+)/i)
  return m?.[1] ? decodeURIComponent(m[1]).trim() : null
}

function buildHanatourDetailUrl(originCode: string, originUrl: string | null): string {
  const code = originCode.trim()
  const stored = (originUrl ?? '').trim()
  if (stored && /hanatour\.com/i.test(stored)) {
    const pkg = pkgCdFromHanatourUrl(stored)
    if (pkg && pkg !== code) {
      console.warn(
        `[hanatour-e2e-db] originUrl pkgCd=${pkg} ≠ originCode=${code} — TRP URL은 originCode 기준으로 보정`
      )
    } else {
      return stored
    }
  }
  return `${HANATOUR_TRP_BASE}?pkgCd=${encodeURIComponent(code)}&type=H01`
}

function parseArgs() {
  const args = process.argv.slice(2)
  let limit = 8
  let queueOnly = false
  let maxMonths = 1
  let auditUrlsOnly = false
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = Math.max(1, parseInt(args[i + 1]!, 10) || 8)
      i++
    } else if (args[i] === '--queue-only') queueOnly = true
    else if (args[i] === '--audit-urls') auditUrlsOnly = true
    else if (args[i] === '--max-months' && args[i + 1]) {
      maxMonths = Math.max(1, parseInt(args[i + 1]!, 10) || 1)
      i++
    }
  }
  return { limit, queueOnly, maxMonths, auditUrlsOnly }
}

async function auditOriginUrls(prisma: PrismaClient): Promise<number> {
  const rows = await prisma.product.findMany({
    where: { registrationStatus: 'registered', originCode: { not: '' } },
    select: { originCode: true, originSource: true, originUrl: true, title: true },
    orderBy: { updatedAt: 'asc' },
  })
  const hanatour = rows.filter((r) => normalizeSupplierOrigin(r.originSource) === 'hanatour')
  const mismatches = hanatour.filter((r) => {
    const pkg = pkgCdFromHanatourUrl(r.originUrl)
    return pkg != null && pkg !== r.originCode.trim()
  })
  console.log(`[audit] hanatour registered=${hanatour.length} url/pkgCd mismatches=${mismatches.length}`)
  for (const r of mismatches) {
    console.log(
      `  ${r.originCode} → url pkgCd=${pkgCdFromHanatourUrl(r.originUrl)} | ${(r.title ?? '').slice(0, 50)}`
    )
  }
  return mismatches.length
}

async function main() {
  const { limit, queueOnly, maxMonths, auditUrlsOnly } = parseArgs()
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
  })

  if (auditUrlsOnly) {
    const n = await auditOriginUrls(prisma)
    await prisma.$disconnect()
    process.exit(n > 0 ? 1 : 0)
  }

  const [queued, allRegistered] = await Promise.all([
    prisma.scraperQueue.findMany({ orderBy: { createdAt: 'asc' }, select: { productId: true } }),
    prisma.product.findMany({
      where: { registrationStatus: 'registered', originCode: { not: '' } },
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        originCode: true,
        originSource: true,
        originUrl: true,
        title: true,
        _count: { select: { departures: true } },
      },
    }),
  ])

  const queuedIds = new Set(queued.map((q) => q.productId))
  const hanatourAll = allRegistered.filter((p) => normalizeSupplierOrigin(p.originSource) === 'hanatour')
  const inQueue = hanatourAll.filter((p) => queuedIds.has(p.id))
  const rest = hanatourAll.filter((p) => !queuedIds.has(p.id))
  const ordered = queueOnly ? inQueue : [...inQueue, ...rest]
  const slice = ordered.slice(0, limit)

  if (slice.length === 0) {
    console.error('[hanatour-e2e-db] 등록된 하나투어 상품이 없습니다.')
    process.exit(1)
  }

  console.log(
    `[hanatour-e2e-db] hanatour registered=${hanatourAll.length} queue=${inQueue.length} testing=${slice.length} maxMonths=${maxMonths}`
  )

  const catalog = slice.map((p) => ({
    id: p.id,
    originCode: p.originCode,
    title: (p.title ?? '').slice(0, 60),
    detailUrl: buildHanatourDetailUrl(p.originCode, p.originUrl),
    dbDepartureCount: p._count.departures,
    inQueue: queuedIds.has(p.id),
  }))

  const root = process.cwd()
  const catalogPath = path.join(root, '.tmp-hanatour-e2e-catalog.json')
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf8')
  console.log(`[hanatour-e2e-db] catalog → ${catalogPath}`)

  const py = spawnSync(
    process.platform === 'win32' ? 'python' : 'python3',
    ['-m', 'scripts.calendar_e2e_scraper_hanatour.main', '--batch', ...catalog.map((c) => c.detailUrl)],
    {
      cwd: root,
      env: {
        ...process.env,
        HANATOUR_E2E_VALIDATION_MAX_MONTHS: String(maxMonths),
        HANATOUR_E2E_VALIDATION_MAX_URLS: String(slice.length),
        HANATOUR_E2E_NO_STDOUT_EMIT: '1',
        HANATOUR_E2E_PROGRESS: '0',
        PYTHONIOENCODING: 'utf-8',
      },
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 600_000 * slice.length,
    }
  )

  const outPath = path.join(root, '.tmp-hanatour-e2e-result.json')
  if (py.stdout?.trim()) {
    try {
      const parsed = JSON.parse(py.stdout) as Record<string, unknown>
      fs.writeFileSync(outPath, JSON.stringify({ catalog, ...parsed }, null, 2), 'utf8')
    } catch {
      fs.writeFileSync(outPath, py.stdout, 'utf8')
    }
  }

  if (py.stderr) process.stderr.write(py.stderr)

  type RunRow = {
    detailUrl?: string
    collectorStatus?: string
    departureCount?: number
    firstVerificationTier?: string
    validation?: { runOutcome?: string; countsByTier?: Record<string, number> }
    notes?: string[]
  }

  let report: { runs?: RunRow[] } = {}
  try {
    report = JSON.parse(py.stdout || '{}') as { runs?: RunRow[] }
  } catch {
    console.error('[hanatour-e2e-db] Python JSON parse failed')
    console.log(py.stdout?.slice(0, 2000))
    process.exit(py.status ?? 1)
  }

  const runs = report.runs ?? []
  let ok = 0
  let partial = 0
  let fail = 0
  const lines: string[] = []
  lines.push('')
  lines.push('=== 하나투어 E2E (DB 상품) 요약 ===')
  for (let i = 0; i < runs.length; i++) {
    const cat = catalog[i]
    const r = runs[i]!
    const st = String(r.collectorStatus ?? '')
    const tier = r.firstVerificationTier ?? r.validation?.runOutcome ?? '—'
    const depN = r.departureCount ?? 0
    const dbN = cat?.dbDepartureCount ?? 0
    const success =
      st === 'success' && depN > 0 && (tier === 'verified_success' || tier === 'partial_success')
    if (success && tier === 'verified_success') ok++
    else if (success) partial++
    else fail++
    const failNote = (r.notes ?? []).find(
      (n) =>
        /modal_open_failed|modal_failed|click_fail|list_static|no_same_product_row/i.test(n)
    )
    lines.push(
      `${i + 1}. ${cat?.originCode ?? '?'} queue=${cat?.inQueue ? 'Y' : 'N'} | collector=${st} | tier=${tier} | e2e_deps=${depN} db_deps=${dbN}${failNote ? ` | note=${failNote.slice(0, 80)}` : ''}`
    )
    lines.push(`   ${cat?.detailUrl ?? r.detailUrl ?? ''}`)
  }
  lines.push('')
  lines.push(`결과: verified/partial=${ok + partial} fail=${fail} / ${runs.length}`)
  lines.push(`상세 JSON: ${outPath}`)
  console.log(lines.join('\n'))

  await prisma.$disconnect()
  process.exit(fail > 0 && ok === 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
