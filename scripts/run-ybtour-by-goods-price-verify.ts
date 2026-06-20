/**
 * ybtour by-goods 다출발 API ↔ evCd /price 교차 검증.
 *
 *   npm run verify:ybtour-by-goods-price
 *   npm run verify:ybtour-by-goods-price -- --limit 5
 *   npm run verify:ybtour-by-goods-price -- --from-slug pkg-yb-0001
 *
 * 결과: ops/ybtour-by-goods-price-verify.json
 */
import './load-env-for-scripts'

import fs from 'fs'
import path from 'path'

import { PrismaClient } from '@prisma/client'

import {
  fetchYbtourEventFirstDisplay,
  fetchYbtourEventPrice,
  parseYbtourEvCdFromUrl,
  resolveYbtourDepartureYmdForEvCd,
  ybtourEventPriceToDepartureInput,
} from '@/lib/ybtour-api-departures'
import { collectYbtourByGoodsApiOnlyForDateRange } from '@/lib/ybtour-price-collect'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const OUT_PATH = path.join(process.cwd(), 'ops', 'ybtour-by-goods-price-verify.json')

const FIXED_CASES = [
  {
    label: 'pkg-evCd',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AAAB001&evCd=AVP4484-260711RS00&goodsCd=AVP4484',
  },
  {
    label: 'pkg-goods-only',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AABF000&goodsCd=AVP4484',
  },
  {
    label: 'fit-no-evCd',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=FIT&dspSid=ABBM000&goodsCd=ATF1143',
  },
  {
    label: 'pkg-evCd-as-goodsCd',
    url: 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&goodsCd=AVP4484-260711RS00&evCd=AVP4484-260711RS00',
  },
] as const

type PriceCheck = {
  evCd: string
  departureYmd: string
  listAdultPrice: number
  priceApiAdultPrice: number | null
  delta: number | null
  match: boolean
}

type CaseResult = {
  label: string
  slug: string | null
  detailUrl: string
  goodsCd: string | null
  dspSid: string | null
  seedEvCd: string | null
  rowCount: number
  rawRowCount: number
  monthKeys: string[]
  apiError: string | null
  priceChecks: PriceCheck[]
  priceMatchCount: number
  priceMismatchCount: number
  priceCheckErrors: number
  elapsedMs: number
}

function readArg(flag: string): string | null {
  const i = process.argv.indexOf(flag)
  if (i < 0 || i + 1 >= process.argv.length) return null
  return process.argv[i + 1]?.trim() || null
}

function readIntArg(flag: string, fallback: number): number {
  const v = readArg(flag)
  if (!v) return fallback
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function buildYbtourDetailUrl(originCode: string): string {
  const code = encodeURIComponent(originCode.trim())
  const detailBase =
    process.env.YBTOUR_PRDT_BASE_URL?.replace(/\/$/, '') ??
    process.env.YELLOWBALLOON_PRDT_BASE_URL?.replace(/\/$/, '') ??
    'https://prdt.ybtour.co.kr'
  return `${detailBase}/product/detailPackage?goodsCd=${code}&menu=PKG`
}

function resolveDetailUrl(originUrl: string | null, originCode: string | null): string | null {
  const stored = (originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const code = (originCode ?? '').trim()
  if (!code) return null
  return buildYbtourDetailUrl(code)
}

function pickSampleIndices(length: number, maxSamples: number): number[] {
  if (length <= 0) return []
  if (length <= maxSamples) return [...Array(length).keys()]
  const out = new Set<number>([0, length - 1, Math.floor(length / 2)])
  while (out.size < maxSamples) {
    out.add(Math.floor((Math.random() * length) | 0))
  }
  return [...out].sort((a, b) => a - b)
}

async function adultPriceFromEvCdPriceApi(
  evCd: string,
  referer: string,
): Promise<number | null> {
  const [price, display] = await Promise.all([
    fetchYbtourEventPrice(evCd, referer),
    fetchYbtourEventFirstDisplay(evCd, referer),
  ])
  if (!price) return null
  const ymd = resolveYbtourDepartureYmdForEvCd(evCd, display)
  if (!ymd) return null
  return ybtourEventPriceToDepartureInput(evCd, price, ymd)?.adultPrice ?? null
}

async function verifyCase(
  label: string,
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  slug: string | null,
  maxPriceChecks: number,
  originCode?: string | null,
): Promise<CaseResult> {
  const t0 = Date.now()
  const hit = await collectYbtourByGoodsApiOnlyForDateRange(detailUrl, fromYmd, toYmd, {
    originCode,
    enrichEvCdPrice: false,
  })
  const priceChecks: PriceCheck[] = []

  if (hit.apiError || hit.inputs.length === 0) {
    return {
      label,
      slug,
      detailUrl,
      goodsCd: hit.goodsCd,
      dspSid: hit.dspSid,
      seedEvCd: hit.seedEvCd,
      rowCount: hit.inputs.length,
      rawRowCount: hit.rawRowCount,
      monthKeys: hit.monthKeys,
      apiError: hit.apiError,
      priceChecks,
      priceMatchCount: 0,
      priceMismatchCount: 0,
      priceCheckErrors: 0,
      elapsedMs: Date.now() - t0,
    }
  }

  const urlEvCd = parseYbtourEvCdFromUrl(detailUrl)
  const indices = pickSampleIndices(hit.inputs.length, maxPriceChecks)
  const forcedEvCdIdx = urlEvCd
    ? hit.inputs.findIndex((x) => x.supplierDepartureCodeCandidate === `ybtour:${urlEvCd}`)
    : -1
  if (forcedEvCdIdx >= 0 && !indices.includes(forcedEvCdIdx)) {
    indices.unshift(forcedEvCdIdx)
    if (indices.length > maxPriceChecks) indices.length = maxPriceChecks
  }

  for (const idx of indices) {
    const row = hit.inputs[idx]!
    const evCd = String(row.supplierDepartureCodeCandidate ?? '').replace(/^ybtour:/, '')
    if (!evCd) continue
    const listAdultPrice = row.adultPrice ?? 0
    let priceApiAdultPrice: number | null = null
    let delta: number | null = null
    let match = false
    try {
      priceApiAdultPrice = await adultPriceFromEvCdPriceApi(evCd, detailUrl)
      if (priceApiAdultPrice != null) {
        delta = listAdultPrice - priceApiAdultPrice
        match = delta === 0
      }
    } catch {
      priceApiAdultPrice = null
    }
    priceChecks.push({
      evCd,
      departureYmd: row.departureDate,
      listAdultPrice,
      priceApiAdultPrice,
      delta,
      match,
    })
  }

  return {
    label,
    slug,
    detailUrl,
    goodsCd: hit.goodsCd,
    dspSid: hit.dspSid,
    seedEvCd: hit.seedEvCd,
    rowCount: hit.inputs.length,
    rawRowCount: hit.rawRowCount,
    monthKeys: hit.monthKeys,
    apiError: hit.apiError,
    priceChecks,
    priceMatchCount: priceChecks.filter((x) => x.match).length,
    priceMismatchCount: priceChecks.filter((x) => x.priceApiAdultPrice != null && !x.match).length,
    priceCheckErrors: priceChecks.filter((x) => x.priceApiAdultPrice == null).length,
    elapsedMs: Date.now() - t0,
  }
}

async function main() {
  const limit = readIntArg('--limit', 0)
  const fromSlug = readArg('--from-slug')
  const maxPriceChecks = readIntArg('--price-checks', 5)
  const useDb = process.argv.includes('--db')

  const todayYmd = kstTodayYmd()
  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  const cases: { label: string; url: string; slug: string | null; originCode: string | null }[] =
    FIXED_CASES.map((c) => ({
      label: c.label,
      url: c.url,
      slug: null,
      originCode: null,
    }))

  if (useDb || limit > 0 || fromSlug) {
    const prisma = new PrismaClient({
      datasourceUrl: process.env.DIRECT_URL || process.env.DATABASE_URL,
    })
    let products = await prisma.product.findMany({
      where: { registrationStatus: 'registered', originSource: 'ybtour' },
      select: { slug: true, originCode: true, originUrl: true },
      orderBy: [{ slug: 'asc' }],
    })
    if (fromSlug) products = products.filter((p) => p.slug === fromSlug)
    const cap = limit > 0 ? limit : products.length
    for (const p of products.slice(0, cap)) {
      const url = resolveDetailUrl(p.originUrl, p.originCode)
      if (!url) continue
      cases.push({ label: `db:${p.slug}`, url, slug: p.slug, originCode: p.originCode })
    }
    await prisma.$disconnect()
  }

  console.log(
    `[ybtour-by-goods-verify] cases=${cases.length} horizon=${fromYmd}..${toYmd} priceChecks=${maxPriceChecks}`,
  )

  const results: CaseResult[] = []
  for (let i = 0; i < cases.length; i += 1) {
    const c = cases[i]!
    const r = await verifyCase(c.label, c.url, fromYmd, toYmd, c.slug, maxPriceChecks, c.originCode)
    results.push(r)
    console.log(
      `[${i + 1}/${cases.length}] ${r.label} rows=${r.rowCount} raw=${r.rawRowCount} dspSid=${r.dspSid} match=${r.priceMatchCount} mismatch=${r.priceMismatchCount}`,
    )
  }

  const summary = {
    cases: results.length,
    with_rows: results.filter((x) => x.rowCount > 0).length,
    total_rows: results.reduce((s, x) => s + x.rowCount, 0),
    price_match: results.reduce((s, x) => s + x.priceMatchCount, 0),
    price_mismatch: results.reduce((s, x) => s + x.priceMismatchCount, 0),
    price_check_errors: results.reduce((s, x) => s + x.priceCheckErrors, 0),
  }

  const report = {
    startedAt: new Date().toISOString(),
    fromYmd,
    toYmd,
    horizonDays: RULE_A_WINDOW_DAYS,
    summary,
    results,
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8')
  console.log('[ybtour-by-goods-verify] summary', summary)
  console.log('[ybtour-by-goods-verify] wrote', OUT_PATH)

  if (summary.price_mismatch > 0) {
    console.error('[ybtour-by-goods-verify] FAIL: price mismatches detected')
    process.exit(1)
  }
  if (summary.price_check_errors > 0) {
    console.error('[ybtour-by-goods-verify] FAIL: price API cross-check errors')
    process.exit(1)
  }
  if (summary.with_rows === 0) {
    console.error('[ybtour-by-goods-verify] FAIL: no priced rows')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
