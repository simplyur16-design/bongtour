/**
 * 교원이지(kyowontour) horizon probe — ops/kyowontour-horizon-probe.json 기준 AJAX 수집.
 *
 *   npx tsx scripts/run-kyowontour-horizon-probe.ts
 *
 * 결과: ops/kyowontour-horizon-probe-result.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { collectKyowontourCalendarRange } from '@/lib/kyowontour-departures'

const PROBE_PATH = path.join(process.cwd(), 'ops', 'kyowontour-horizon-probe.json')
const OUT_PATH = path.join(process.cwd(), 'ops', 'kyowontour-horizon-probe-result.json')

type ProbeEntry = {
  label: string
  tourCode: string
  url: string
  departYmd?: string
  adultPrice?: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(PROBE_PATH, 'utf8')) as { probes?: ProbeEntry[] }
  const probes = raw.probes ?? []
  const pauseMs = Math.max(0, Number(process.env.KYOWONTOUR_PROBE_PAUSE_MS ?? '500') || 500)
  const items: Array<Record<string, unknown>> = []

  for (const probe of probes) {
    const masterCode = probe.tourCode.slice(0, 6)
    const { rows, warnings } = await collectKyowontourCalendarRange(masterCode, {
      tourCodeForE2EFallback: probe.tourCode,
      monthCount: 6,
      log: true,
      logLabel: probe.label,
    })
    const anchor = rows.find((r) => r.departDate === probe.departYmd)
    items.push({
      label: probe.label,
      tourCode: probe.tourCode,
      masterCode,
      url: probe.url,
      rowCount: rows.length,
      anchorDepart: probe.departYmd ?? null,
      anchorFound: Boolean(anchor),
      anchorPrice: anchor?.adultPriceFromCalendar ?? null,
      expectedPrice: probe.adultPrice ?? null,
      priceMatch: anchor && probe.adultPrice ? anchor.adultPriceFromCalendar === probe.adultPrice : null,
      warnings: warnings.slice(0, 8),
      sampleDates: rows.slice(0, 5).map((r) => ({
        departDate: r.departDate,
        price: r.adultPriceFromCalendar,
        status: r.status,
      })),
    })
    if (pauseMs > 0) await sleep(pauseMs)
  }

  const out = {
    finishedAt: new Date().toISOString(),
    probeFile: PROBE_PATH,
    summary: {
      total: items.length,
      withRows: items.filter((x) => (x.rowCount as number) > 0).length,
      anchorMatched: items.filter((x) => x.anchorFound === true).length,
    },
    items,
  }
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: true, outFile: OUT_PATH, summary: out.summary }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
