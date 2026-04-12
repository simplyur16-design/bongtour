import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import * as updItinHanatour from '@/lib/upsert-itinerary-days-hanatour'
import * as updItinModetour from '@/lib/upsert-itinerary-days-modetour'
import * as updItinVerygoodtour from '@/lib/upsert-itinerary-days-verygoodtour'
import * as updItinYbtour from '@/lib/upsert-itinerary-days-ybtour'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

function upsertItineraryModuleForProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}) {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource)
  if (fromBrand === 'modetour') return updItinModetour
  if (fromBrand === 'verygoodtour') return updItinVerygoodtour
  if (fromBrand === 'ybtour') return updItinYbtour
  if (fromBrand === 'hanatour') return updItinHanatour
  if (norm === 'modetour') return updItinModetour
  if (norm === 'verygoodtour') return updItinVerygoodtour
  if (norm === 'ybtour') return updItinYbtour
  return updItinHanatour
}

type RouteParams = { params: Promise<{ id: string }> }

/**
 * GET /api/admin/products/[id]/itinerary-days — 상품별 ItineraryDay 원문 정본 조회. 인증: 관리자.
 * day ASC 정렬. productId가 없으면 404.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const itineraryDays = await prisma.itineraryDay.findMany({
      where: { productId: id },
      orderBy: { day: 'asc' },
      select: {
        id: true,
        productId: true,
        day: true,
        dateText: true,
        city: true,
        summaryTextRaw: true,
        poiNamesRaw: true,
        meals: true,
        accommodation: true,
        transport: true,
        notes: true,
        rawBlock: true,
      },
    })
    return NextResponse.json(itineraryDays)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/products/[id]/itinerary-days — Product.schedule 기반 ItineraryDay 재적재. 인증: 관리자.
 * GET=조회, POST=재수집/적재 실행.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { id } = await params
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        schedule: true,
        originSource: true,
        brand: { select: { brandKey: true } },
      },
    })
    if (!product) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!product.schedule) {
      return NextResponse.json({ ok: false, error: 'schedule 데이터가 없습니다.' }, { status: 404 })
    }
    let arr: Array<{ day?: number; title?: string; description?: string; imageKeyword?: string }> = []
    try {
      const parsed = JSON.parse(product.schedule) as unknown
      arr = Array.isArray(parsed) ? (parsed as Array<{ day?: number; title?: string; description?: string; imageKeyword?: string }>) : []
    } catch {
      return NextResponse.json({ ok: false, error: 'schedule JSON 파싱 실패' }, { status: 400 })
    }
    const itinMod = upsertItineraryModuleForProduct({
      originSource: product.originSource,
      brand: product.brand,
    })
    const dayInputs = itinMod.registerScheduleToDayInputs(arr)
    if (dayInputs.length === 0) {
      return NextResponse.json({ ok: false, error: '재수집할 일정표 데이터가 없습니다.' }, { status: 404 })
    }
    await itinMod.upsertItineraryDays(prisma, product.id, dayInputs)
    return NextResponse.json({
      ok: true,
      productId: product.id,
      mode: 'schedule-reapply',
      source: 'product-schedule-json',
      count: dayInputs.length,
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
