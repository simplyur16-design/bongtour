/**
 * 한진관광 첫 수집 → 등록대기 한 번에.
 * listing → 지역필터 선정만(판단보류·제외 제외) → detail → handler.
 * 기본은 계획만 출력한다. --apply 가 있을 때만 DB에 pending 을 기록한다.
 * 호출 간격·직렬·재시도·403/429 중단은 createHanjintourClient 그대로다.
 * 출력은 건수와 상품번호(gdsNo)만.
 * REGRESSION-FREEZE[hanjintour-register-pending-only]: 계획 기본·--apply 때만 기록 — manifest
 */
import { handleParseAndRegisterHanjintourRequest } from '../lib/parse-and-register-hanjintour-handler'
import { planHanjintourPendingEnqueue } from '../lib/hanjintour-register'
import {
  fetchHanjintourCalendar,
  fetchHanjintourDisplayList,
  fetchHanjintourEventList,
  fetchHanjintourGnbMenu,
  fetchHanjintourSchedule,
  hanjintourSearchWindow,
} from '../lib/hanjintour-api'
import { type HanjintourClient } from '../lib/hanjintour-http'
import {
  parseHanjintourCalendar,
  parseHanjintourDisplayList,
  parseHanjintourEventList,
  parseHanjintourPackageLeaves,
  parseHanjintourSchedule,
  type HanjintourDeparture,
} from '../lib/hanjintour-parse'
import { hanjinFailureName, hanjinWalkStopReason } from '../lib/hanjintour-ingest-stop'
import {
  HANJINTOUR_EXISTING_SUPPLIERS,
  buildExistingRegionIndex,
  classifyHanjintourListing,
  hanjintourDetailCollectAllowed,
  type ExistingProductRegionRow,
  type HanjintourListingForRegion,
} from '../lib/hanjintour-region-filter'
export type HanjintourIngestSummary = {
  listed: number
  selected: number
  held: number
  excluded: number
  planned: number
  applied: number
  skipped: number
  gdsNos: string[]
  stoppedReason: string | null
}

export async function runHanjintourIngestPending(opts: {
  client: HanjintourClient
  loadExistingRows: () => Promise<ExistingProductRegionRow[]>
  apply: boolean
  limit: number
  now?: Date
  register?: (body: unknown) => Promise<{ body: { success?: boolean } }>
}): Promise<HanjintourIngestSummary> {
  const now = opts.now ?? new Date()
  const win = hanjintourSearchWindow(now)
  const todayIso = now.toISOString().slice(0, 10)
  const empty = (stoppedReason: string | null, listed = 0): HanjintourIngestSummary => ({
    listed,
    selected: 0,
    held: 0,
    excluded: 0,
    planned: 0,
    applied: 0,
    skipped: 0,
    gdsNos: [],
    stoppedReason,
  })
  // 지역 색인은 화면을 읽기 전에 불러 온다. 읽기 실패는 1회만 다시 한다.
  let existingRaw: ExistingProductRegionRow[]
  try {
    existingRaw = await opts.loadExistingRows()
  } catch {
    try {
      existingRaw = await opts.loadExistingRows()
    } catch {
      return empty('db_read')
    }
  }
  const existingRows = existingRaw.filter((r) =>
    (HANJINTOUR_EXISTING_SUPPLIERS as readonly string[]).includes(String(r.originSource)),
  )
  const index = buildExistingRegionIndex(existingRows)
  let gnb: unknown
  try {
    gnb = await fetchHanjintourGnbMenu(opts.client)
  } catch (e) {
    return empty(hanjinWalkStopReason(e) ?? hanjinFailureName(e))
  }
  const leaves = parseHanjintourPackageLeaves(gnb)
  const byGds = new Map<string, HanjintourListingForRegion>()
  const PAGE = 100
  for (const leaf of leaves) {
    let start = 0
    for (let page = 0; page < 5; page++) {
      let body: unknown
      try {
        body = await fetchHanjintourDisplayList(opts.client, { dspCtgNo: leaf.dspCtgNo, ...win, start, size: PAGE })
      } catch (e) {
        const stop = hanjinWalkStopReason(e)
        if (stop) return empty(stop, byGds.size)
        break
      }
      const { items, totalCnt } = parseHanjintourDisplayList(body)
      for (const it of items) {
        const prev = byGds.get(it.gdsNo)
        if (prev) {
          if (!prev.categoryPaths.some((p) => p.join('>') === leaf.path.join('>'))) prev.categoryPaths.push(leaf.path)
        } else byGds.set(it.gdsNo, { gdsNo: it.gdsNo, title: it.title, categoryPaths: [leaf.path] })
      }
      start += PAGE
      if (start >= totalCnt || items.length === 0) break
    }
  }

  let held = 0
  let excluded = 0
  const selected: HanjintourListingForRegion[] = []
  for (const it of byGds.values()) {
    const decision = classifyHanjintourListing(it, index)
    if (decision.decision === '판단보류') held++
    else if (decision.decision === '제외') excluded++
    else if (hanjintourDetailCollectAllowed(decision)) selected.push(it)
  }
  const queue = selected.slice(0, Math.max(0, opts.limit))
  const gdsNos: string[] = []
  let skipped = 0
  let applied = 0
  for (const it of queue) {
    try {
      const cal = await fetchHanjintourCalendar(opts.client, { gdsNo: it.gdsNo, ...win })
      const departures = parseHanjintourCalendar(cal)
      const first = departures[0]
      let merged: HanjintourDeparture[] = departures
      if (first) {
        const ev = await fetchHanjintourEventList(opts.client, { gdsNo: it.gdsNo, date: first.rawDate, ...win })
        const extra = new Map(parseHanjintourEventList(ev, first.date).map((row) => [row.evtNo, row]))
        merged = departures.map((row) => {
          const add = extra.get(row.evtNo)
          return add
            ? { ...row, childPrice: add.childPrice ?? null, infantPrice: add.infantPrice ?? null, airline: add.airline ?? row.airline ?? null }
            : row
        })
      }
      const schedule = first ? parseHanjintourSchedule(await fetchHanjintourSchedule(opts.client, first.evtNo)) : { days: [] }
      const body = {
        gdsNo: it.gdsNo,
        title: it.title,
        categoryPaths: it.categoryPaths,
        departures: merged,
        days: schedule.days,
        existingRows,
        todayIso,
      }
      if (!opts.apply) {
        const plan = planHanjintourPendingEnqueue(body)
        if (!plan.ok) skipped++
        else gdsNos.push(it.gdsNo)
        continue
      }
      const result = await opts.register!(body)
      if (result.body.success) {
        applied++
        gdsNos.push(it.gdsNo)
      } else skipped++
    } catch (e) {
      skipped++
      const stop = hanjinWalkStopReason(e)
      if (stop) {
        return {
          listed: byGds.size,
          selected: selected.length,
          held,
          excluded,
          planned: 0,
          applied,
          skipped,
          gdsNos,
          stoppedReason: stop,
        }
      }
    }
  }

  return {
    listed: byGds.size,
    selected: selected.length,
    held,
    excluded,
    planned: opts.apply ? 0 : gdsNos.length,
    applied,
    skipped,
    gdsNos,
    stoppedReason: null,
  }
}

function readArgs(argv: string[]) {
  const args = Object.fromEntries(
    argv.map((a) => {
      const m = a.match(/^--([^=]+)=(.*)$/)
      return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true']
    }),
  )
  return { apply: args.apply === 'true', limit: Number(args.limit ?? 9999) }
}

async function main() {
  const { apply, limit } = readArgs(process.argv.slice(2))
  const { prisma } = await import('../lib/prisma')
  const { createHanjintourClient } = await import('../lib/hanjintour-http')
  const summary = await runHanjintourIngestPending({
    client: createHanjintourClient(),
    apply,
    limit: Number.isFinite(limit) ? limit : 9999,
    loadExistingRows: async () =>
      prisma.product.findMany({
        where: { originSource: { in: [...HANJINTOUR_EXISTING_SUPPLIERS] } },
        select: {
          originSource: true,
          title: true,
          destination: true,
          primaryDestination: true,
        },
      }),
    register: (body) => handleParseAndRegisterHanjintourRequest(prisma, body),
  })
  console.log(
    JSON.stringify({
      listed: summary.listed,
      selected: summary.selected,
      held: summary.held,
      excluded: summary.excluded,
      planned: summary.planned,
      applied: summary.applied,
      skipped: summary.skipped,
      stoppedReason: summary.stoppedReason,
      gdsNos: summary.gdsNos,
    }),
  )
}

const entry = process.argv[1]?.replace(/\\/g, '/')
if (entry?.endsWith('scripts/hanjintour-ingest-pending.ts')) {
  main().catch((e) => {
    const message = hanjinFailureName(e)
    console.error(message)
    process.exit(1)
  })
}
