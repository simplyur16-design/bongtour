/**
 * 대표 출발 재수집 계획(READ-ONLY, dry-run 전용) — DB 쓰기 없음.
 * REGRESSION-FREEZE[rep-departure-future-1031]: 스냅샷 출발일 < 오늘(KST) 인 상품 → 오늘 이후 가장 가까운 판매 중 출발을 재수집 대상으로 출력.
 *
 *   npx tsx scripts/plan-representative-recollect.ts [--out tmp/rep-recollect-plan.csv]
 *
 * 실제 재수집(--apply)은 오너 승인 후 별도 단계: 이 스크립트는 대상 목록만 만든다(가격·제목·원문 미변경).
 */
import './load-env-for-scripts'
import { mkdirSync, writeFileSync } from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import {
  carrierLabelsEquivalent,
  kstTodayYmdForRepresentative,
  planRepresentativeRecollect,
  resolveRepresentativeFlightSnapshot,
} from '@/lib/representative-departure-snapshot'

function argValue(name: string): string | null {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] ?? null : null
}

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  if (process.argv.includes('--apply')) {
    throw new Error('--apply 미지원: 재수집 실행은 오너 승인 후 별도 단계입니다(이 스크립트는 READ-ONLY).')
  }
  const prisma = new PrismaClient()
  const today = kstTodayYmdForRepresentative()
  const out = argValue('--out') ?? path.join('tmp', `rep-recollect-plan-${today}.csv`)
  const rows: Record<string, unknown>[] = []
  try {
    const products = await prisma.product.findMany({
      select: { id: true, slug: true, originSource: true, originCode: true, registrationStatus: true, rawMeta: true },
    })
    for (const p of products) {
      let meta: unknown = p.rawMeta
      if (typeof meta === 'string') {
        try {
          meta = JSON.parse(meta)
        } catch {
          meta = null
        }
      }
      const ss = meta && typeof meta === 'object' ? (meta as { structuredSignals?: unknown }).structuredSignals : null
      const snapshot = resolveRepresentativeFlightSnapshot({ structuredSignals: ss, originCode: p.originCode })
      const deps = await prisma.productDeparture.findMany({
        where: { productId: p.id },
        select: { departureDate: true, supplierDepartureCodeCandidate: true, statusRaw: true, isBookable: true, carrierName: true },
        orderBy: { departureDate: 'asc' },
      })
      const plan = planRepresentativeRecollect({
        snapshot,
        todayYmd: today,
        departures: deps.map((d) => ({
          ymd: d.departureDate.toISOString().slice(0, 10),
          code: d.supplierDepartureCodeCandidate,
          statusRaw: d.statusRaw,
          isBookable: d.isBookable,
        })),
      })
      if (plan.reason !== 'snapshot_past' && plan.reason !== 'no_future_on_sale') continue
      const target = plan.target
      const targetCarrier = target
        ? deps.find((d) => d.departureDate.toISOString().slice(0, 10) === target.ymd)?.carrierName ?? null
        : null
      rows.push({
        slug: p.slug,
        status: p.registrationStatus,
        origin: p.originSource,
        originCode: p.originCode,
        snapshotYmd: plan.snapshotYmd,
        snapshotAirline: snapshot.airline,
        snapshotFlights: [snapshot.outboundFlightNo, snapshot.inboundFlightNo].filter(Boolean).join('/'),
        reason: plan.reason,
        targetYmd: target?.ymd ?? '',
        targetCode: target?.code ?? '',
        targetCarrier: targetCarrier ?? '',
        airlineDiffers: Boolean(targetCarrier && snapshot.airline && !carrierLabelsEquivalent(snapshot.airline, targetCarrier)),
      })
    }
  } finally {
    await prisma.$disconnect()
  }
  mkdirSync(path.dirname(out), { recursive: true })
  const cols = Object.keys(rows[0] ?? { slug: '' })
  writeFileSync(out, '\ufeff' + [cols.join(','), ...rows.map((r) => cols.map((k) => csvEscape(r[k])).join(','))].join('\n'))
  console.log(`[rep-recollect-plan] today=${today} targets=${rows.filter((r) => r.reason === 'snapshot_past').length} noFuture=${rows.filter((r) => r.reason === 'no_future_on_sale').length} → ${out}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
