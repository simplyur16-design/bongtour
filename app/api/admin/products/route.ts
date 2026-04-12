import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { mapToParsedProductForDB } from '@/lib/map-to-parsed-product'
import type { ExtractedProduct } from '@/lib/extraction-schema'
import type { ExtractedPricingSchedule, ExtractedDailyScheduleItem } from '@/lib/extraction-schema'
import type { ParsedProductForDB } from '@/lib/parsed-product-types'
import * as updDeparturesHanatour from '@/lib/upsert-product-departures-hanatour'
import * as updDeparturesModetour from '@/lib/upsert-product-departures-modetour'
import * as updDeparturesVerygoodtour from '@/lib/upsert-product-departures-verygoodtour'
import * as updDeparturesYbtour from '@/lib/upsert-product-departures-ybtour'
import * as updItinHanatour from '@/lib/upsert-itinerary-days-hanatour'
import * as updItinModetour from '@/lib/upsert-itinerary-days-modetour'
import * as updItinVerygoodtour from '@/lib/upsert-itinerary-days-verygoodtour'
import * as updItinYbtour from '@/lib/upsert-itinerary-days-ybtour'
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'

/** calendar-prices / departures POST와 동일 기준: brandKey 우선 → normalizeSupplierOrigin 폴백 */
function upsertDeparturesModuleForProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}) {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource)
  if (fromBrand === 'modetour') return updDeparturesModetour
  if (fromBrand === 'verygoodtour') return updDeparturesVerygoodtour
  if (fromBrand === 'ybtour') return updDeparturesYbtour
  if (fromBrand === 'hanatour') return updDeparturesHanatour
  if (norm === 'modetour') return updDeparturesModetour
  if (norm === 'verygoodtour') return updDeparturesVerygoodtour
  if (norm === 'ybtour') return updDeparturesYbtour
  return updDeparturesHanatour
}

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
 * GET /api/admin/products — 저장된 상품 목록. 인증: 관리자.
 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const products = await prisma.product.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        originSource: true,
        originCode: true,
        title: true,
        destination: true,
        duration: true,
        updatedAt: true,
      },
    })
    return NextResponse.json(products)
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}

function productToUpdateData(parsed: ParsedProductForDB) {
  const schedule =
    parsed.itineraries?.length > 0
      ? JSON.stringify(
          parsed.itineraries.map((i) => ({
            day: i.day,
            title: '',
            description: i.description ?? '',
            imageKeyword: `day ${i.day} travel`,
            imageUrl: null,
          }))
        )
      : null

  return {
    originSource: parsed.originSource?.trim() || '직접입력',
    title: parsed.title?.trim() || '상품명 없음',
    destination: parsed.destination?.trim() || '미지정',
    destinationRaw: parsed.destinationRaw?.trim() || null,
    primaryDestination: parsed.primaryDestination?.trim() || null,
    supplierGroupId: parsed.supplierGroupId?.trim() || null,
    productType: parsed.productType?.trim() || 'travel',
    airtelHotelInfoJson: parsed.airtelHotelInfoJson ?? null,
    airportTransferType: parsed.airportTransferType ?? null,
    optionalToursStructured: parsed.optionalToursStructured ?? null,
    priceFrom: parsed.priceFrom ?? null,
    priceCurrency: parsed.priceCurrency?.trim() || null,
    duration: parsed.duration?.trim() || '미지정',
    airline: parsed.airline?.trim() || null,
    isFuelIncluded: parsed.isFuelIncluded !== false,
    isGuideFeeIncluded: parsed.isGuideFeeIncluded === true,
    mandatoryLocalFee: parsed.mandatoryLocalFee ?? null,
    mandatoryCurrency: parsed.mandatoryCurrency ?? null,
    includedText: parsed.includedText ?? null,
    excludedText: parsed.excludedText ?? null,
    counselingNotes: null,
    criticalExclusions: parsed.criticalExclusions ?? null,
    schedule,
    registrationStatus: 'pending' as const,
  }
}

/**
 * POST /api/admin/products — 상품 대시보드에서 AI 추출 후 저장.
 * Body: ExtractedProduct + dailyPrices?, organizerName?, primaryDestination?
 * 응답: { detailPath, message } (JSON). 빈 응답이면 클라이언트에서 res.json() 실패함.
 *
 * [세트 데이터] AI 추출 정보는 그대로 한 세트로 이동. mapToParsedProductForDB로
 * 변환한 parsed 전체로 Product·가격·일정을 한 번에 갱신하여 데이터 정확히 반영.
 * 인증: 관리자.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await request.json()) as ExtractedProduct & {
      dailyPrices?: { date: string; price: string }[]
      organizerName?: string
      primaryDestination?: string
      brandKey?: string
    }

    const product: ExtractedProduct = { ...body }
    if (body.primaryDestination?.trim()) product.primaryDestination = body.primaryDestination.trim()

    const brandKey = typeof body.brandKey === 'string' ? body.brandKey.trim() || null : null
    let originSource = body.organizerName?.trim() || '대시보드'
    let brandId: string | null = null
    if (brandKey) {
      const brand = await prisma.brand.findUnique({ where: { brandKey } })
      if (brand) {
        originSource = brand.displayName
        brandId = brand.id
      }
    }

    const dailyPrices = body.dailyPrices ?? []
    const syntheticPricing: ExtractedPricingSchedule | null =
      dailyPrices.length > 0 && body.productCode
        ? {
            product_code: body.productCode.trim(),
            daily_schedule: dailyPrices.map(
              (row): ExtractedDailyScheduleItem => ({
                date: String(row.date ?? '').slice(0, 10),
                status: '예약가능',
                pricing: {
                  adult: {
                    base: 0,
                    fuel: 0,
                    total: parseInt(String(row.price).replace(/,/g, ''), 10) || 0,
                  },
                },
              })
            ),
          }
        : null

    const parsed = mapToParsedProductForDB(product, syntheticPricing, originSource)

    if (!parsed.originCode?.trim() || parsed.originCode === '미지정') {
      return NextResponse.json(
        { error: '상품코드(originCode)를 입력하세요.' },
        { status: 400 }
      )
    }

    const effectiveOriginSource = parsed.originSource?.trim() || originSource
    const existing = await prisma.product.findUnique({
      where: {
        originSource_originCode: {
          originSource: effectiveOriginSource,
          originCode: parsed.originCode,
        },
      },
      select: {
        id: true,
        brand: { select: { brandKey: true } },
      },
    })

    const updateData = {
      ...productToUpdateData(parsed),
      ...(brandId != null && { brandId }),
    }
    let productId: string

    if (existing) {
      await prisma.$transaction(async (tx) => {
        await tx.productPrice.deleteMany({ where: { productId: existing.id } })
        await tx.itinerary.deleteMany({ where: { productId: existing.id } })
        await tx.product.update({
          where: { id: existing.id },
          data: updateData,
        })
      })
      productId = existing.id
    } else {
      const { registrationStatus: _rs, ...createData } = updateData
      const created = await prisma.product.create({
        data: {
          ...createData,
          originCode: parsed.originCode,
        },
      })
      productId = created.id
    }

    // 저장 직후 등록대기 목록에 보이도록 registrationStatus = 'pending' 확실히 설정
    try {
      await prisma.product.update({
        where: { id: productId },
        data: { registrationStatus: 'pending' },
      })
    } catch {
      try {
        await prisma.$executeRawUnsafe(
          'UPDATE Product SET registrationStatus = ? WHERE id = ?',
          'pending',
          productId
        )
      } catch {
        // 스키마/클라이언트에 따라 무시
      }
    }

    const brandKeyForUpsertPicker =
      (brandKey ?? existing?.brand?.brandKey ?? null)?.trim() || null
    const upsertModulePickerInput = {
      originSource: effectiveOriginSource,
      brand: brandKeyForUpsertPicker ? { brandKey: brandKeyForUpsertPicker } : null,
    }

    if ((parsed.prices?.length || 0) > 0) {
      await prisma.productPrice.createMany({
        data: parsed.prices!.map((p) => {
          const adultTotal = (p.adultBase ?? 0) + (p.adultFuel ?? 0)
          const fuel = Number(p.childFuel) || 0
          const childBedTotal =
            p.childBedBase != null ? (Number(p.childBedBase) || 0) + fuel : 0
          const childNoBedTotal =
            p.childNoBedBase != null ? (Number(p.childNoBedBase) || 0) + fuel : 0
          const infantTotal =
            p.infantBase != null || p.infantFuel != null
              ? (Number(p.infantBase) || 0) + (Number(p.infantFuel) || 0)
              : 0
          return {
            productId,
            date: new Date(p.date),
            adult: adultTotal,
            childBed: childBedTotal || 0,
            childNoBed: childNoBedTotal || 0,
            infant: infantTotal || 0,
            priceGap: 0,
          }
        }),
      })
      const depMod = upsertDeparturesModuleForProduct(upsertModulePickerInput)
      const departureInputs = depMod.parsedPricesToDepartureInputs(parsed.prices!)
      await depMod.upsertProductDepartures(prisma, productId, departureInputs)
    }
    if ((parsed.itineraries?.length || 0) > 0) {
      await prisma.itinerary.createMany({
        data: parsed.itineraries!.map((i) => ({
          productId,
          day: i.day,
          description: i.description ?? '',
        })),
      })
      const itinMod = upsertItineraryModuleForProduct(upsertModulePickerInput)
      const itineraryDayInputs =
        product.itinerary?.length > 0
          ? itinMod.extractedItineraryToDayInputs(product.itinerary)
          : itinMod.parsedItinerariesToDayInputs(parsed.itineraries!)
      if (itineraryDayInputs.length > 0) {
        await itinMod.upsertItineraryDays(prisma, productId, itineraryDayInputs)
      }
    }

    return NextResponse.json({
      detailPath: `/admin/products/${productId}`,
      message: existing ? '기존 상품이 업데이트되었습니다.' : '저장되었습니다.',
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
