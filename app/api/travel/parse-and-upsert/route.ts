import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { extractTravelProductForDB } from '@/lib/travel-parse'
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
import { normalizeOriginSource } from '@/lib/supplier-origin'
import { buildParseSupplierInputDebug, normalizeParseRequestOriginSource } from '@/lib/parse-api-origin-source'

/** POST …/parse-and-upsert — `?debugSupplier=1` 시 성공 JSON에 `supplierInputDebug`(body raw, coerce, upsert effective). */

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
// [일정 정책] Product.schedule = 렌더용; 레거시 Itinerary = 호환 보조; ItineraryDay = 원문 정본. docs/itinerary-policy.md

/**
 * POST /api/travel/parse-and-upsert
 * 여행사 원본 텍스트를 받아 LLM으로 파싱 후 DB에 저장 또는 업데이트(Upsert by originSource+originCode).
 * 포함/불포함·현지비까지 추출하여 Product에 반영.
 * 인증: 관리자 세션(role === 'ADMIN') 필수.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }
  try {
    const debugSupplier = new URL(request.url).searchParams.get('debugSupplier') === '1'
    const body = await request.json()
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    const brandKey = typeof body.brandKey === 'string' ? body.brandKey.trim() || null : null
    const rawOriginFromBody =
      typeof body.originSource === 'string' && body.originSource.trim()
        ? body.originSource.trim()
        : brandKey || '직접입력'
    const originSourceCoerced = normalizeParseRequestOriginSource(rawOriginFromBody, brandKey)
    let originSource = normalizeOriginSource(originSourceCoerced, brandKey)
    let brandId: string | null = null
    if (brandKey) {
      const brand = await prisma.brand.findUnique({ where: { brandKey } })
      if (brand) {
        brandId = brand.id
      }
    }
    const parsedBody = body.parsed as ParsedProductForDB | undefined

    let parsed: ParsedProductForDB
    if (parsedBody?.originCode) {
      parsed = {
        ...parsedBody,
        originSource: normalizeOriginSource(
          normalizeParseRequestOriginSource(parsedBody.originSource || originSource, brandKey),
          brandKey
        ),
      }
    } else if (text) {
      parsed = await extractTravelProductForDB(text, originSource)
    } else {
      return NextResponse.json({ error: 'text 또는 parsed는 필수입니다.' }, { status: 400 })
    }

    if (!parsed.originCode || parsed.originCode === '미지정') {
      return NextResponse.json(
        { error: '상품코드(originCode)를 추출할 수 없습니다. 텍스트에 상품코드를 포함해 주세요.' },
        { status: 400 }
      )
    }

    const effectiveOriginSource = normalizeOriginSource(parsed.originSource?.trim() || '직접입력', brandKey)
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

    let productId: string

    const updateData = {
      ...productToUpdateData(parsed),
      ...(brandId != null && { brandId }),
    }
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
    // Itinerary: 병행 기록(보조). 표시는 schedule 우선.
    if ((parsed.itineraries?.length || 0) > 0) {
      await prisma.itinerary.createMany({
        data: parsed.itineraries!.map((i) => ({
          productId,
          day: i.day,
          description: i.description ?? '',
        })),
      })
      const itinMod = upsertItineraryModuleForProduct(upsertModulePickerInput)
      const itineraryDayInputs = itinMod.parsedItinerariesToDayInputs(parsed.itineraries!)
      if (itineraryDayInputs.length > 0) {
        await itinMod.upsertItineraryDays(prisma, productId, itineraryDayInputs)
      }
    }

    return NextResponse.json({
      ok: true,
      isNew: !existing,
      productId,
      originCode: parsed.originCode,
      detailPath: `/admin/products/${productId}`,
      message: existing ? '기존 상품이 업데이트되었습니다.' : '새 상품이 저장되었습니다.',
      parsed,
      ...(debugSupplier && {
        supplierInputDebug: buildParseSupplierInputDebug({
          requestRaw: rawOriginFromBody,
          coerced: originSourceCoerced,
          effective: effectiveOriginSource,
        }),
      }),
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : '파싱 또는 저장 실패' },
      { status: 500 }
    )
  }
}

/** [일정 SSOT] Product.schedule 작성 규칙: 배열 항목은 day(필수), description(필수), title/imageKeyword/imageUrl(선택). process-images가 나중에 imageUrl 채움. */
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
