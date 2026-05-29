/**
 * modetour 월간 sweep — GetOtherDepartureDates(minPrice) 경량 수집 + ProductDeparture upsert.
 * instrumentation 등록 전 수동 POST `/api/cron/modetour-sweep` 로만 검증.
 */
import type { PrismaClient } from '@prisma/client'

import {
  isModetourSd1NotFoundError,
  ModetourB2cApiError,
  MODETOUR_SD1_AUTO_UNPUBLISH_REASON,
} from '@/lib/modetour-sd1-policy'
import { parseModetourPackageProductNoFromUrl } from '@/lib/modetour-departures'
import {
  addDaysUtcYmd,
  computePriceFromFromDepartureInputs,
  computeRuleAMarkersFromDepartureInputs,
  kstTodayYmd,
  RULE_A_WINDOW_DAYS,
} from '@/lib/product-sales-policy'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import {
  upsertProductDepartures,
  type DepartureInput,
} from '@/lib/upsert-product-departures-modetour'

const MODETOUR_API_BASE = process.env.MODETOUR_API_BASE_URL ?? 'https://b2c-api.modetour.com'
const MODETOUR_WEB_API_REQ_HEADER =
  process.env.MODETOUR_WEB_API_REQ_HEADER ??
  '{"WebSiteNo":2,"CompanyNo":81202,"DeviceType":"DVTPC","ApiKey":"jm9i5RUzKPMPdklHzDKqNzwZYy0IGV5hTyKkCcpxO0IGIgVS+8Z7NnbzbARv5w7Bn90KT13Gq79XZMow6TYvwQ=="}'

const SWEEP_DUE_DAYS = 30

type ModetourDepartureRow = {
  pId?: number
  minPrice?: number
  departureDate?: string
}

type ModetourDepartureResponse = {
  result?: ModetourDepartureRow[]
  errorMessages?: Array<{ errorCode?: string; errorMessage?: string } | string> | null
  isOK?: boolean
}

export type ModetourSweepResult = {
  processed: number
  updated: number
  retired: number
  skipped: number
  pruned: number
}

type SweepProductRow = {
  id: string
  originUrl: string | null
}

function modetourSweepHeaders(referer: string, productNo: string): HeadersInit {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ko-KR',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    referer,
    'x-platform': 'ModeEcommerce',
    'x-salespartner': '2',
    'x-userdepartment': 'ModeEcommerce',
    'x-incomming-pathname': `/package/${productNo}`,
    modewebapireqheader: MODETOUR_WEB_API_REQ_HEADER,
  }
}

async function fetchModetourJson<T>(url: string, headers: HeadersInit): Promise<T> {
  const res = await fetch(url, { method: 'GET', headers })
  if (!res.ok) {
    const bodyText = await res.text()
    let bodyJson: unknown = null
    try {
      bodyJson = JSON.parse(bodyText) as unknown
    } catch {
      bodyJson = null
    }
    throw new ModetourB2cApiError(res.status, url, bodyText, bodyJson)
  }
  return (await res.json()) as T
}

/**
 * sweep 전용 경량 수집 — GetOtherDepartureDates 1회, minPrice → adultPrice.
 * per-pId GetProductDetailInfo·HTML fetch 없음.
 */
async function collectModetourSweepDepartureInputs(
  originUrl: string | null | undefined,
  fromYmd: string,
  toYmd: string
): Promise<{ inputs: DepartureInput[]; apiDates: string[] }> {
  const productNo = parseModetourPackageProductNoFromUrl(originUrl)
  if (!productNo) return { inputs: [], apiDates: [] }

  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const referer = originUrl?.trim() || `https://www.modetour.com/package/${productNo}`
  const headers = modetourSweepHeaders(referer, productNo)
  const apiUrl = `${MODETOUR_API_BASE.replace(/\/$/, '')}/Package/GetOtherDepartureDates?productNo=${encodeURIComponent(productNo)}&searchFrom=${lo}&searchTo=${hi}`

  const json = await fetchModetourJson<ModetourDepartureResponse>(apiUrl, headers)
  const rows = Array.isArray(json?.result) ? json.result : []

  const apiDates: string[] = []
  const inputs: DepartureInput[] = []
  for (const r of rows) {
    const departureDate = String(r.departureDate ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) continue
    if (departureDate >= lo && departureDate <= hi) {
      apiDates.push(departureDate)
    }

    const price = Number(r.minPrice ?? 0)
    if (!Number.isFinite(price) || price <= 0) continue

    const pid = String(r.pId ?? '').trim()
    inputs.push({
      departureDate,
      adultPrice: price,
      supplierDepartureCodeCandidate: pid ? `modetour:${pid}` : null,
      localPriceText: pid ? `modetour:pId=${pid}`.slice(0, 200) : null,
    })
  }
  return { inputs, apiDates }
}

function ymdToUtcMidnight(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`)
}

async function findSweepProducts(
  prisma: PrismaClient,
  limit: number,
  productNo?: string | null
): Promise<SweepProductRow[]> {
  const select = { id: true, originUrl: true } as const

  if (productNo?.trim()) {
    const forcedNo = productNo.trim()
    const rows = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        originSource: 'modetour',
      },
      select,
    })
    return rows
      .filter((p) => parseModetourPackageProductNoFromUrl(p.originUrl) === forcedNo)
      .slice(0, 1)
  }

  const cutoff = new Date(Date.now() - SWEEP_DUE_DAYS * 24 * 60 * 60 * 1000)
  return prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      originSource: 'modetour',
      OR: [{ lastSalesPolicyCheckedAt: null }, { lastSalesPolicyCheckedAt: { lt: cutoff } }],
    },
    orderBy: [{ lastSalesPolicyCheckedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    take: limit,
    select,
  })
}

/**
 * modetour 등록 상품 월간 sweep — 경량 출발일 upsert + Rule A 마커·priceFrom 갱신.
 */
export async function sweepDueModetourProducts(
  prisma: PrismaClient,
  options?: { limit?: number; productNo?: string | null }
): Promise<ModetourSweepResult> {
  const limit = Math.max(1, Math.min(500, options?.limit ?? 50))
  const products = await findSweepProducts(prisma, limit, options?.productNo ?? null)

  const result: ModetourSweepResult = {
    processed: 0,
    updated: 0,
    retired: 0,
    skipped: 0,
    pruned: 0,
  }

  const todayYmd = kstTodayYmd()
  const fromYmd = todayYmd
  const toYmd = addDaysUtcYmd(todayYmd, RULE_A_WINDOW_DAYS)

  for (const product of products) {
    result.processed += 1
    const now = new Date()

    try {
      const { inputs, apiDates } = await collectModetourSweepDepartureInputs(
        product.originUrl,
        fromYmd,
        toYmd
      )
      const inWindow = inputs.filter((x) => {
        const dk = departureInputToYmd(x.departureDate)
        return dk != null && dk >= fromYmd && dk <= toYmd
      })

      if (inWindow.length > 0) {
        await upsertProductDepartures(prisma, product.id, inWindow)
      }

      let prunedCount = 0
      if (apiDates.length > 0) {
        const notIn = [...new Set(apiDates)].map(ymdToUtcMidnight)
        const deleted = await prisma.productDeparture.deleteMany({
          where: {
            productId: product.id,
            departureDate: {
              gte: ymdToUtcMidnight(fromYmd),
              lte: ymdToUtcMidnight(toYmd),
              notIn,
            },
          },
        })
        prunedCount = deleted.count
        result.pruned += prunedCount
      }

      const markers = computeRuleAMarkersFromDepartureInputs(inWindow, todayYmd)
      const priceFrom = computePriceFromFromDepartureInputs(inWindow, todayYmd)

      await prisma.product.update({
        where: { id: product.id },
        data: {
          noFutureDepartureConfirmedAt: markers.noFutureDepartureConfirmedAt,
          lastFutureDepartureDate: markers.lastFutureDepartureDate,
          ...(priceFrom != null ? { priceFrom } : {}),
          lastSalesPolicyCheckedAt: now,
        },
      })
      result.updated += 1
    } catch (err) {
      if (isModetourSd1NotFoundError(err)) {
        await prisma.product.update({
          where: { id: product.id },
          data: {
            registrationStatus: 'auto_unpublished',
            autoUnpublishedReason: MODETOUR_SD1_AUTO_UNPUBLISH_REASON,
            autoUnpublishedAt: now,
            lastSalesPolicyCheckedAt: now,
          },
        })
        result.retired += 1
        continue
      }

      const msg = err instanceof Error ? err.message : String(err)
      console.warn('[modetour-sweep] skip', {
        productId: product.id,
        message: msg.slice(0, 400),
      })
      await prisma.product.update({
        where: { id: product.id },
        data: { lastSalesPolicyCheckedAt: now },
      })
      result.skipped += 1
    }
  }

  return result
}
