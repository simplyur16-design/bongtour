/**
 * lottetour probe URL — 180일 evtListAjax HXR 커버리지 (DB·E2E upsert 없음).
 *
 * SSOT probe: ops/lottetour-evtListAjax-probe.json
 *
 *   npm run db:lottetour-hxr-coverage
 *   npm run db:lottetour-hxr-coverage -- --live
 *
 * 결과: ops/lottetour-horizon-hxr-coverage.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import {
  collectLottetourHxrOnlyForDateRange,
  type LottetourCollectContext,
} from '@/lib/lottetour-price-collect'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const PROBE_PATH = path.join(process.cwd(), 'ops', 'lottetour-evtListAjax-probe.json')
const OUT_PATH = path.join(process.cwd(), 'ops', 'lottetour-horizon-hxr-coverage.json')

type ProbeEntry = {
  label: string
  url: string
  godId: string
  menuNos: [string, string, string, string]
  productCodeHint?: string
}

type ItemResult = {
  label: string
  url: string
  godId: string
  status: 'hxr_ok' | 'hxr_empty' | 'hxr_error'
  rowCount: number
  hxrError: string | null
  elapsedMs: number
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function interProbePauseMs(): number {
  const raw = Number(process.env.LOTTETOUR_HXR_COVERAGE_PAUSE_MS ?? '800')
  return Number.isFinite(raw) && raw >= 0 ? raw : 800
}

function loadProbes(): ProbeEntry[] {
  const raw = JSON.parse(fs.readFileSync(PROBE_PATH, 'utf8')) as Array<Record<string, unknown>>
  return raw.map((e) => ({
    label: String(e.label ?? ''),
    url: String(e.url ?? ''),
    godId: String(e.godId ?? ''),
    menuNos: (e.menuNos as [string, string, string, string]) ?? ['', '', '', ''],
    productCodeHint: e.productCodeHint != null ? String(e.productCodeHint) : undefined,
  }))
}

function ctxFromProbe(p: ProbeEntry): LottetourCollectContext {
  return {
    godId: p.godId,
    menuNos: p.menuNos,
    detailEvtCd: p.productCodeHint?.match(/^[A-Z]\d{2}[A-Z]\d{6}[A-Z]{2}\d{3}$/) ? p.productCodeHint : null,
    detailUrl: p.url,
    evtCdHint: p.productCodeHint ?? null,
  }
}

async function main() {
  const live = process.argv.includes('--live')
  const probes = loadProbes()
  const todayYmd = kstTodayYmd()
  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)
  const pauseMs = interProbePauseMs()

  if (!live) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          probeFile: PROBE_PATH,
          horizonDays: RULE_A_WINDOW_DAYS,
          fromYmd,
          toYmd,
          probes: probes.map((p) => ({
            label: p.label,
            url: p.url,
            godId: p.godId,
            menuNos: p.menuNos,
          })),
          hint: 'Pass --live to fetch evtListAjax',
        },
        null,
        2,
      ),
    )
    return
  }

  const results: ItemResult[] = []
  const startedAt = new Date().toISOString()

  for (let i = 0; i < probes.length; i += 1) {
    const p = probes[i]!
    const t0 = Date.now()
    console.error(`[hxr-coverage] ${i + 1}/${probes.length} ${p.label} godId=${p.godId}`)

    const hit = await collectLottetourHxrOnlyForDateRange(
      ctxFromProbe(p),
      `probe-${p.label}`,
      fromYmd,
      toYmd,
      { logLabel: `hxr-coverage:${p.label}` },
    )

    const elapsedMs = Date.now() - t0

    results.push({
      label: p.label,
      url: p.url,
      godId: p.godId,
      status: hit.hxrError ? 'hxr_error' : hit.inputs.length > 0 ? 'hxr_ok' : 'hxr_empty',
      rowCount: hit.inputs.length,
      hxrError: hit.hxrError,
      elapsedMs,
    })

    if (i + 1 < probes.length && pauseMs > 0) {
      await sleep(pauseMs)
    }
  }

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    horizonDays: RULE_A_WINDOW_DAYS,
    fromYmd,
    toYmd,
    total: results.length,
    hxr_ok: results.filter((r) => r.status === 'hxr_ok').length,
    hxr_empty: results.filter((r) => r.status === 'hxr_empty').length,
    hxr_error: results.filter((r) => r.status === 'hxr_error').length,
    items: results,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2), 'utf8')
  console.log(JSON.stringify({ ok: true, outFile: OUT_PATH, ...summary }, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
