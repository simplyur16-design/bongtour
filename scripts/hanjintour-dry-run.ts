/**
 * 한진관광 수집 dry-run (DB 쓰기 없음). 단계:
 *   --phase=listing  메뉴 + 패키지 말단 분류 목록만 호출 → listing.json
 *   --phase=compare  기존 7곳 지역 스냅샷(--existing=JSON)과 대조 → region-compare.json / hanjin-region-compare.csv
 *   --phase=detail   선정 상품만 출발일·행사(가격)·일정 호출 → detail/<gdsNo>.json + dryrun-table.csv
 * 호출은 lib/hanjintour-http.ts 의 순차 클라이언트만 사용한다.
 *
 * npx tsx scripts/hanjintour-dry-run.ts --phase=listing --out=.review-out/hanjin-1114/run
 */
import fs from 'node:fs'
import path from 'node:path'
import { createHanjintourClient, HanjintourBlockedError } from '../lib/hanjintour-http'
import {
  fetchHanjintourCalendar,
  fetchHanjintourDisplayList,
  fetchHanjintourEventList,
  fetchHanjintourGnbMenu,
  fetchHanjintourSchedule,
  hanjintourSearchWindow,
} from '../lib/hanjintour-api'
import {
  parseHanjintourCalendar,
  parseHanjintourDisplayList,
  parseHanjintourEventList,
  parseHanjintourPackageLeaves,
  parseHanjintourSchedule,
  hanjintourShouldEnqueuePending,
  stripHanjintourContactFields,
} from '../lib/hanjintour-parse'
import {
  buildExistingRegionIndex,
  classifyHanjintourListing,
  hanjintourDetailCollectAllowed,
  type ExistingProductRegionRow,
  type HanjintourListingForRegion,
  type HanjintourRegionDecision,
} from '../lib/hanjintour-region-filter'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ''), 'true']
  }),
)
const OUT = path.resolve(args.out ?? '.review-out/hanjin-1114/run')
fs.mkdirSync(OUT, { recursive: true })
const write = (name: string, v: unknown) => fs.writeFileSync(path.join(OUT, name), typeof v === 'string' ? v : JSON.stringify(v, null, 1))
const client = createHanjintourClient()
const skips: Array<{ step: string; key: string; reason: string }> = []

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message.slice(0, 300) : String(e)
}

async function listing() {
  const win = hanjintourSearchWindow(new Date())
  const gnb = await fetchHanjintourGnbMenu(client)
  fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true })
  fs.writeFileSync(path.join(OUT, 'raw', 'gnb.json'), JSON.stringify(stripHanjintourContactFields(gnb)))
  const leaves = parseHanjintourPackageLeaves(gnb)
  const byGds = new Map<string, HanjintourListingForRegion>()
  const PAGE = 100
  for (const leaf of leaves) {
    let start = 0
    for (let page = 0; page < 5; page++) {
      let body: unknown
      try {
        body = await fetchHanjintourDisplayList(client, { dspCtgNo: leaf.dspCtgNo, ...win, start, size: PAGE })
      } catch (e) {
        skips.push({ step: 'listing', key: leaf.dspCtgNo, reason: reasonOf(e) })
        if (e instanceof HanjintourBlockedError) throw e
        break
      }
      fs.writeFileSync(path.join(OUT, 'raw', `list-${leaf.dspCtgNo}-${start}.json`), JSON.stringify(stripHanjintourContactFields(body)))
      const { items, totalCnt } = parseHanjintourDisplayList(body)
      for (const it of items) {
        const prev = byGds.get(it.gdsNo)
        if (prev) {
          if (!prev.categoryPaths.some((p) => p.join('>') === leaf.path.join('>'))) prev.categoryPaths.push(leaf.path)
        } else byGds.set(it.gdsNo, { ...it, categoryPaths: [leaf.path] })
      }
      start += PAGE
      if (start >= totalCnt || items.length === 0) break
    }
  }
  write('listing.json', { at: new Date().toISOString(), window: win, leaves: leaves.length, calls: client.callCount(), items: [...byGds.values()], skips })
  console.log(JSON.stringify({ leaves: leaves.length, goods: byGds.size, calls: client.callCount(), skips: skips.length }))
}

const csvEsc = (v: unknown) => {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function compare() {
  const listingDoc = JSON.parse(fs.readFileSync(path.join(OUT, 'listing.json'), 'utf8'))
  const existingDoc = JSON.parse(fs.readFileSync(path.resolve(args.existing), 'utf8'))
  const rows = (existingDoc.rows as ExistingProductRegionRow[]).filter((r) =>
    ['hanatour', 'modetour', 'ybtour', 'naeiltour', 'lottetour', 'verygoodtour', 'kyowontour'].includes(String(r.originSource)),
  )
  const index = buildExistingRegionIndex(rows, existingDoc.cities ?? [])
  const results = (listingDoc.items as HanjintourListingForRegion[]).map((it) => ({ it, r: classifyHanjintourListing(it, index) }))
  const header = ['gdsNo', 'title', 'categoryPaths', 'places', 'newPlaces', 'existingPlaces', 'existingSuppliers', 'decision', 'basis']
  const lines = [header.join(',')]
  for (const { it, r } of results) {
    lines.push(
      [
        it.gdsNo,
        it.title,
        it.categoryPaths.map((p) => p.join('>')).join(' | '),
        r.places.join('/'),
        r.newPlaces.join('/'),
        r.existingPlaces.map((p) => p.place).join('/'),
        [...new Set(r.existingPlaces.flatMap((p) => p.suppliers))].join('/'),
        r.decision,
        r.basis,
      ]
        .map(csvEsc)
        .join(','),
    )
  }
  fs.writeFileSync(path.join(OUT, 'hanjin-region-compare.csv'), '\ufeff' + lines.join('\n') + '\n')
  const tally = results.reduce<Record<string, number>>((m, x) => ((m[x.r.decision] = (m[x.r.decision] ?? 0) + 1), m), {})
  write('region-compare.json', { at: new Date().toISOString(), existingProducts: rows.length, tally, selected: results.filter((x) => x.r.decision === '선정').map((x) => ({ ...x.it, ...x.r })) })
  console.log(JSON.stringify({ existingProducts: rows.length, tally }))
}

async function detail() {
  const doc = JSON.parse(fs.readFileSync(path.join(OUT, 'region-compare.json'), 'utf8'))
  const limit = Number(args.limit ?? 9999)
  const selected = (doc.selected as Array<HanjintourListingForRegion & HanjintourRegionDecision>)
    .filter((g) => hanjintourDetailCollectAllowed(g))
    .slice(0, limit)
  const win = hanjintourSearchWindow(new Date())
  fs.mkdirSync(path.join(OUT, 'detail'), { recursive: true })
  const table: string[] = [['gdsNo', 'title', 'newPlaces', 'departures', 'firstDate', 'lastDate', 'minAdultPrice', 'maxAdultPrice', 'scheduleDays', 'enqueue', 'skip'].join(',')]
  for (const g of selected) {
    const rec: Record<string, unknown> = { gdsNo: g.gdsNo, title: g.title }
    try {
      const cal = await fetchHanjintourCalendar(client, { gdsNo: g.gdsNo, ...win })
      rec.calendarRaw = stripHanjintourContactFields(cal)
      // 달력이 출발일별 행사·성인 요금(원문)을 모두 준다 → 출발일 목록 SSOT
      const departures = parseHanjintourCalendar(cal)
      const eventDetails = []
      for (const d of departures.slice(0, Number(args.maxDates ?? 1))) {
        const ev = await fetchHanjintourEventList(client, { gdsNo: g.gdsNo, date: d.rawDate, ...win })
        ;((rec.eventRaw ??= []) as unknown[]).push(stripHanjintourContactFields(ev))
        eventDetails.push(...parseHanjintourEventList(ev, d.date))
      }
      rec.departures = departures
      rec.eventDetails = eventDetails
      const firstEvt = departures[0]?.evtNo
      if (firstEvt) {
        const sc = await fetchHanjintourSchedule(client, firstEvt)
        rec.scheduleRaw = stripHanjintourContactFields(sc)
        rec.schedule = parseHanjintourSchedule(sc)
      }
      const prices = departures.map((x) => x.adultPrice).filter((n): n is number => n != null)
      const days = (rec.schedule as { days?: unknown[] } | undefined)?.days?.length ?? 0
      table.push(
        [
          g.gdsNo,
          g.title,
          g.newPlaces.join('/'),
          departures.length,
          departures[0]?.date ?? '',
          departures.at(-1)?.date ?? '',
          prices.length ? Math.min(...prices) : '',
          prices.length ? Math.max(...prices) : '',
          days,
          hanjintourShouldEnqueuePending({ departures }) ? 'Y' : 'N',
          departures.length === 0 ? 'no_departure' : '',
        ]
          .map(csvEsc)
          .join(','),
      )
    } catch (e) {
      skips.push({ step: 'detail', key: g.gdsNo, reason: reasonOf(e) })
      table.push([g.gdsNo, g.title, g.newPlaces.join('/'), '', '', '', '', '', '', 'N', reasonOf(e)].map(csvEsc).join(','))
      if (e instanceof HanjintourBlockedError) break
    }
    write(`detail/${g.gdsNo}.json`, rec)
  }
  fs.writeFileSync(path.join(OUT, 'dryrun-table.csv'), '\ufeff' + table.join('\n') + '\n')
  write('detail-skips.json', skips)
  console.log(JSON.stringify({ selected: selected.length, calls: client.callCount(), skips: skips.length }))
}

async function main() {
  try {
    if (args.phase === 'listing') await listing()
    else if (args.phase === 'compare') compare()
    else if (args.phase === 'detail') await detail()
    else throw new Error('--phase=listing|compare|detail')
  } finally {
    write(`calls-${args.phase}.json`, client.log)
  }
}
main().catch((e) => {
  console.error(reasonOf(e))
  process.exit(1)
})
