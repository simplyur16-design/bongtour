/**
 * Operator URL batch — DB-stored schedule imageKeyword audit (empty / trip-dup / Brazil FP).
 * npx tsx scripts/audit-operator-url-batch-schedule-keywords.ts
 */
import './load-env-for-scripts'
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { normScheduleImageKeywordKey } from '../lib/register-schedule-llm-image-keyword-fallback'

type Hit = {
  code: string
  originSource: string
  title: string
  status: string
  days: number
  emptyKw1: number[]
  emptyKw2Middle: number[]
  dups: string[]
  brazilFp: string[]
  sample: Array<{ day: number; route: string; kw1: string; kw2: string }>
}

function extractCodes(url: string): { supplier: string; code: string } | null {
  try {
    const u = new URL(url)
    const host = u.hostname
    if (host.includes('ybtour')) {
      const ev = u.searchParams.get('evCd') ?? ''
      return { supplier: 'ybtour', code: ev.split('-')[0] || ev }
    }
    if (host.includes('hanatour')) {
      return { supplier: 'hanatour', code: u.searchParams.get('pkgCd') ?? '' }
    }
    if (host.includes('lottetour')) {
      return { supplier: 'lottetour', code: u.searchParams.get('evtCd') ?? '' }
    }
    if (host.includes('kyowontour')) {
      return { supplier: 'kyowontour', code: u.searchParams.get('tourCode') ?? '' }
    }
    if (host.includes('modetour')) {
      const id = u.pathname.split('/').filter(Boolean).pop() ?? ''
      return { supplier: 'modetour', code: id }
    }
  } catch {
    return null
  }
  return null
}

function isBrazilLike(s: string): boolean {
  return /brazil|브라질|rio\s*de\s*janeiro|christ\s*the\s*redeemer|sugar\s*loaf|corcovado|코르코바도/i.test(s)
}

function isEuropeishTitle(title: string): boolean {
  return /유럽|발칸|프라하|비엔나|부다|크로아|체코|오스트리|헝가리|이탈리|스위스|독일|프랑스|스페인|그리스|북유럽|동유럽/i.test(
    title,
  )
}

async function main() {
  const file = path.join(process.cwd(), 'scripts/data/operator-url-batch-2026-07-12-empirical.txt')
  const urls = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const unique = [...new Set(urls)]
  const codes = unique.map(extractCodes).filter(Boolean) as Array<{ supplier: string; code: string }>

  const hits: Hit[] = []
  const missing: string[] = []

  for (const { supplier, code } of codes) {
    if (!code) continue
    const rows = await prisma.product.findMany({
      where: {
        OR: [
          { originCode: { contains: code } },
          { originUrl: { contains: code } },
          { supplierProductCode: { contains: code } },
        ],
      },
      select: {
        id: true,
        title: true,
        originCode: true,
        originSource: true,
        originUrl: true,
        registrationStatus: true,
        schedule: true,
      },
      take: 3,
    })
    if (!rows.length) {
      missing.push(`${supplier}:${code}`)
      continue
    }

    for (const p of rows) {
      const schedule =
        typeof p.schedule === 'string'
          ? (JSON.parse(p.schedule) as Array<Record<string, unknown>>)
          : ((p.schedule as Array<Record<string, unknown>> | null) ?? [])
      if (!Array.isArray(schedule) || !schedule.length) {
        hits.push({
          code: p.originCode ?? code,
          originSource: p.originSource,
          title: p.title,
          status: p.registrationStatus,
          days: 0,
          emptyKw1: [],
          emptyKw2Middle: [],
          dups: ['schedule empty'],
          brazilFp: [],
          sample: [],
        })
        continue
      }

      const maxDay = Math.max(...schedule.map((r) => Number(r.day ?? 0)))
      const used = new Map<string, number>()
      const emptyKw1: number[] = []
      const emptyKw2Middle: number[] = []
      const dups: string[] = []
      const brazilFp: string[] = []
      const sample: Hit['sample'] = []

      for (const r of schedule) {
        const day = Number(r.day ?? 0)
        const kw1 = String(r.imageKeyword ?? '').trim()
        const kw2 = String(r.imageKeyword2 ?? '').trim()
        const route = String(r.routeText ?? '').trim()
        sample.push({
          day,
          route: route.slice(0, 80),
          kw1: kw1 || '(empty)',
          kw2: kw2 || '(null)',
        })
        if (!kw1) emptyKw1.push(day)
        const isEdge = day <= 1 || day >= maxDay
        if (!isEdge && !kw2 && schedule.length >= 4) emptyKw2Middle.push(day)

        for (const slot of [kw1, kw2]) {
          if (!slot) continue
          const nk = normScheduleImageKeywordKey(slot)
          if (!nk) continue
          if (used.has(nk)) dups.push(`D${day} "${slot}" also D${used.get(nk)}`)
          else used.set(nk, day)
        }

        const blob = `${route}\n${kw1}\n${kw2}`
        if (isBrazilLike(blob) && isEuropeishTitle(p.title)) {
          brazilFp.push(`D${day}: ${blob.match(/brazil|브라질|rio|christ|sugar|corcovado|코르코바도/gi)?.join(',')}`)
        }
        // 불리우는 → 리우 substring in route for Europe
        if (isEuropeishTitle(p.title) && /리우/u.test(route) && !/리우데|리우\s*데|Rio/i.test(route)) {
          const ctx = route.match(/.{0,8}리우.{0,8}/)?.[0]
          if (ctx && /불리우|불리우는/.test(route)) {
            brazilFp.push(`D${day}: 리우-in-불리우는 (${ctx})`)
          }
        }
      }

      hits.push({
        code: p.originCode ?? code,
        originSource: p.originSource,
        title: p.title.slice(0, 80),
        status: p.registrationStatus,
        days: schedule.length,
        emptyKw1,
        emptyKw2Middle,
        dups,
        brazilFp,
        sample,
      })
    }
  }

  const bad = hits.filter((h) => h.emptyKw1.length || h.dups.length || h.brazilFp.length || h.emptyKw2Middle.length)
  console.log(JSON.stringify({ urlCount: unique.length, found: hits.length, missing, badCount: bad.length, bad, all: hits }, null, 2))
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
