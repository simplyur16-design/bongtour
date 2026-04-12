import { NextRequest, NextResponse } from 'next/server'
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

/**
 * POST /api/admin/scheduler/products/refresh
 * 등록완료(registered) 상품 대상 주기 갱신 기반.
 * - departures: 스크래퍼 큐에 적재(기본 하루 1회, 임박상품은 운영에서 빈도 상향)
 * - itinerary: Product.schedule → ItineraryDay 재적재(기본 1~3일 1회)
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await req.json().catch(() => ({}))) as {
      target?: 'departures' | 'itinerary'
      productIds?: string[]
    }
    const target = body.target ?? 'departures'
    const explicitIds = Array.isArray(body.productIds) ? body.productIds.filter((x) => typeof x === 'string') : []
    const products = await prisma.product.findMany({
      where: {
        registrationStatus: 'registered',
        ...(explicitIds.length > 0 ? { id: { in: explicitIds } } : {}),
      },
      select: {
        id: true,
        schedule: true,
        originSource: true,
        brand: { select: { brandKey: true } },
      },
      take: 500,
    })

    if (target === 'departures') {
      const existing = await prisma.scraperQueue.findMany({
        where: { productId: { in: products.map((p) => p.id) } },
        select: { productId: true },
      })
      const set = new Set(existing.map((e) => e.productId))
      const toAdd = products.map((p) => p.id).filter((id) => !set.has(id))
      if (toAdd.length > 0) {
        await prisma.scraperQueue.createMany({
          data: toAdd.map((productId) => ({ productId })),
        })
      }
      return NextResponse.json({
        ok: true,
        target,
        mode: 'live-rescrape',
        source: 'calendar-scraper-queue',
        queued: toAdd.length,
        policy: {
          departures: '기본 하루 1회, 출발 14일 이내 상품은 운영 정책으로 2~4회 상향 가능',
        },
      })
    }

    let refreshed = 0
    for (const p of products) {
      if (!p.schedule) continue
      try {
        const parsed = JSON.parse(p.schedule) as Array<{ day?: number; title?: string; description?: string; imageKeyword?: string }>
        const itinMod = upsertItineraryModuleForProduct({
          originSource: p.originSource,
          brand: p.brand,
        })
        const inputs = itinMod.registerScheduleToDayInputs(Array.isArray(parsed) ? parsed : [])
        if (inputs.length === 0) continue
        await itinMod.upsertItineraryDays(prisma, p.id, inputs)
        refreshed += 1
      } catch {
        // skip bad schedule rows
      }
    }
    return NextResponse.json({
      ok: true,
      target,
      mode: 'fallback-rebuild',
      source: 'product-schedule-json',
      refreshed,
      policy: {
        itineraryDays: '기본 1~3일 1회 (최소 하루 1회도 운영 선택 가능)',
      },
    })
  } catch (e) {
    console.error('scheduler/products/refresh:', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
