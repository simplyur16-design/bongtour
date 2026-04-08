import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import type { ParsedProductForDB } from '@/lib/parsed-product-types'

/**
 * GET /api/admin/products/v2 — 새 스키마 상품 목록. 인증: 관리자 세션 또는(개발) mock.
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

/**
 * POST /api/admin/products/v2 — ParsedProductForDB 저장. 인증: 관리자 세션 또는(개발) mock.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const body = (await request.json()) as ParsedProductForDB
    const {
      originSource,
      originCode,
      title,
      destination,
      duration,
      airline,
      isFuelIncluded,
      isGuideFeeIncluded,
      mandatoryLocalFee,
      mandatoryCurrency,
      includedText,
      excludedText,
      prices,
      itineraries,
    } = body

    if (!originCode?.trim() || !title?.trim() || !destination?.trim()) {
      return NextResponse.json(
        { error: 'originCode, title, destination는 필수입니다.' },
        { status: 400 }
      )
    }

    const product = await prisma.product.create({
      data: {
        originSource: originSource?.trim() || '직접입력',
        originCode: originCode.trim(),
        title: title.trim(),
        destination: destination.trim(),
        duration: (duration ?? '').trim() || '미지정',
        airline: airline?.trim() || null,
        isFuelIncluded: isFuelIncluded !== false,
        isGuideFeeIncluded: isGuideFeeIncluded === true,
        mandatoryLocalFee: mandatoryLocalFee ?? null,
        mandatoryCurrency: mandatoryCurrency ?? null,
        includedText: includedText ?? null,
        excludedText: excludedText ?? null,
      },
    })

    if (prices?.length) {
      await prisma.productPrice.createMany({
        data: prices.map((p) => {
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
            productId: product.id,
            date: new Date(p.date),
            adult: adultTotal,
            childBed: childBedTotal || 0,
            childNoBed: childNoBedTotal || 0,
            infant: infantTotal || 0,
            priceGap: 0,
          }
        }),
      })
    }

    if (itineraries?.length) {
      await prisma.itinerary.createMany({
        data: itineraries.map((i) => ({
          productId: product.id,
          day: i.day,
          description: i.description ?? '',
        })),
      })
    }

    return NextResponse.json({
      id: product.id,
      originCode: product.originCode,
      detailPath: `/admin/products/${product.id}`,
      message: '저장되었습니다.',
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
