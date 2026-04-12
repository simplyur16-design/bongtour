import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { executeAdminDeparturesRescrapeCore } from '@/lib/admin-execute-departures-rescrape'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { validateHanatourAdminMonthYm } from '@/lib/hanatour-departures'

const HANATOUR_BASE = process.env.HANATOUR_BASE_URL ?? 'https://www.hanatour.com'

function isHanatourProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}): boolean {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource ?? '')
  return fromBrand === 'hanatour' || norm === 'hanatour'
}

/** 목록·실행 공통: 등록완료 + 하나투어 + 상품코드(pkgCd로 상세 URL 구성 가능). originUrl 있으면 표시·링크용. */
function isEligibleForHanatourMonthRescrape(p: {
  registrationStatus: string | null
  originCode: string | null
  originUrl: string | null
  originSource: string | null
  brand: { brandKey: string } | null
}): boolean {
  if (p.registrationStatus !== 'registered') return false
  if (!isHanatourProduct(p)) return false
  return (p.originCode ?? '').trim().length > 0
}

function buildHanatourDetailUrlForList(originCode: string, originUrl: string | null): string {
  const u = (originUrl ?? '').trim()
  if (u.startsWith('http')) return u
  const code = encodeURIComponent(originCode.trim())
  return `${HANATOUR_BASE.replace(/\/$/, '')}/package/detail?pkgCd=${code}`
}

/** DB `ProductDeparture.departureDate` → YYYY-MM-DD (UTC 일자) */
function formatDepartureYmd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export type HanatourMonthListItem = {
  id: string
  title: string
  originCode: string
  originUrl: string | null
  detailUrl: string
  updatedAt: string
  /** ProductDeparture 최소 출발일, 없으면 null */
  priceStartDate: string | null
  /** ProductDeparture 최대 출발일, 없으면 null */
  priceEndDate: string | null
  departureRowCount: number
}

/**
 * GET /api/admin/scheduler/hanatour-month-departures
 * 하나투어 등록완료·재수집 가능 상품 목록 (스케줄러 선택 UI 전용).
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') ?? '').trim().toLowerCase()
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '300', 10) || 300))

    const rows = await prisma.product.findMany({
      where: { registrationStatus: 'registered' },
      select: {
        id: true,
        title: true,
        originCode: true,
        originUrl: true,
        originSource: true,
        registrationStatus: true,
        updatedAt: true,
        brand: { select: { brandKey: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 800,
    })

    const eligible = rows.filter(isEligibleForHanatourMonthRescrape)
    const filtered = q
      ? eligible.filter((p) => {
          const t = (p.title ?? '').toLowerCase()
          const c = (p.originCode ?? '').toLowerCase()
          return t.includes(q) || c.includes(q)
        })
      : eligible

    const sliced = filtered.slice(0, limit)
    const idList = sliced.map((p) => p.id)

    let aggByProduct = new Map<
      string,
      { min: Date; max: Date; count: number }
    >()
    if (idList.length > 0) {
      const groups = await prisma.productDeparture.groupBy({
        by: ['productId'],
        where: { productId: { in: idList } },
        _min: { departureDate: true },
        _max: { departureDate: true },
        _count: { _all: true },
      })
      aggByProduct = new Map(
        groups.map((g) => [
          g.productId,
          {
            min: g._min.departureDate!,
            max: g._max.departureDate!,
            count: g._count._all,
          },
        ])
      )
    }

    const items: HanatourMonthListItem[] = sliced.map((p) => {
      const g = aggByProduct.get(p.id)
      return {
        id: p.id,
        title: p.title,
        originCode: (p.originCode ?? '').trim(),
        originUrl: p.originUrl?.trim() || null,
        detailUrl: buildHanatourDetailUrlForList(p.originCode ?? '', p.originUrl),
        updatedAt: p.updatedAt.toISOString(),
        priceStartDate: g ? formatDepartureYmd(g.min) : null,
        priceEndDate: g ? formatDepartureYmd(g.max) : null,
        departureRowCount: g?.count ?? 0,
      }
    })

    return NextResponse.json({ ok: true, items, totalEligible: eligible.length })
  } catch (e) {
    console.error('hanatour-month-departures GET:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

export type HanatourMonthRunItem = {
  productId: string
  title: string
  month: string
  status: 'ok' | 'failed' | 'skipped'
  collectedCount: number
  upsertedCount: number
  error: string | null
  liveError: string | null
  elapsedMs: number
}

/**
 * POST /api/admin/scheduler/hanatour-month-departures
 * 선택한 하나투어 상품만 지정 월(YYYY-MM) 출발 재수집.
 * Body: { productIds: string[], hanatourMonth?: string, monthYyyymm?: string }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as {
      productIds?: unknown
      hanatourMonth?: string
      monthYyyymm?: string
    }
    const rawMonth = String(body.hanatourMonth ?? body.monthYyyymm ?? '').trim()
    const ym = validateHanatourAdminMonthYm(rawMonth)
    if (!ym) {
      return NextResponse.json(
        { ok: false, error: 'hanatourMonth는 YYYY-MM 형식이어야 합니다.' },
        { status: 400 }
      )
    }

    const ids = Array.isArray(body.productIds)
      ? body.productIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : []
    if (ids.length === 0) {
      return NextResponse.json({ ok: false, error: 'productIds가 비어 있습니다.' }, { status: 400 })
    }

    const results: HanatourMonthRunItem[] = []

    for (const productId of ids) {
      const t0 = Date.now()
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          title: true,
          originSource: true,
          originCode: true,
          originUrl: true,
          registrationStatus: true,
          brand: { select: { brandKey: true } },
        },
      })

      if (!product) {
        results.push({
          productId,
          title: '—',
          month: ym,
          status: 'skipped',
          collectedCount: 0,
          upsertedCount: 0,
          error: '상품 없음',
          liveError: null,
          elapsedMs: Date.now() - t0,
        })
        continue
      }

      const title = product.title ?? '—'

      if (!isEligibleForHanatourMonthRescrape(product)) {
        results.push({
          productId,
          title,
          month: ym,
          status: 'skipped',
          collectedCount: 0,
          upsertedCount: 0,
          error: '하나투어 등록완료·재수집 가능 조건에 맞지 않음',
          liveError: null,
          elapsedMs: Date.now() - t0,
        })
        continue
      }

      const row = {
        id: product.id,
        originSource: product.originSource,
        originCode: product.originCode,
        originUrl: product.originUrl,
        brand: product.brand,
      }

      try {
        const { status, body: out } = await executeAdminDeparturesRescrapeCore(prisma, row, ym)
        const elapsedMs = Date.now() - t0
        const ok = out.ok && status >= 200 && status < 300
        results.push({
          productId,
          title,
          month: ym,
          status: ok ? 'ok' : 'failed',
          collectedCount: out.collectedCount ?? 0,
          upsertedCount: out.upsertedCount ?? 0,
          error: ok ? null : out.message ?? out.error ?? `HTTP ${status}`,
          liveError: out.liveError ?? null,
          elapsedMs,
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({
          productId,
          title,
          month: ym,
          status: 'failed',
          collectedCount: 0,
          upsertedCount: 0,
          error: msg.slice(0, 400),
          liveError: null,
          elapsedMs: Date.now() - t0,
        })
      }

      await new Promise((r) => setTimeout(r, 400))
    }

    const successCount = results.filter((r) => r.status === 'ok').length
    const failedCount = results.filter((r) => r.status === 'failed').length
    const skippedCount = results.filter((r) => r.status === 'skipped').length

    return NextResponse.json({
      ok: true,
      hanatourMonth: ym,
      successCount,
      failedCount,
      skippedCount,
      results,
    })
  } catch (e) {
    console.error('hanatour-month-departures POST:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
