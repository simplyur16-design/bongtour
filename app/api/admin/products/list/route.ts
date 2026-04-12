import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { computeAdminProductSupplierDerivatives } from '@/lib/admin-product-supplier-derivatives'
import { countScheduleDays } from '@/lib/schedule-days'

const LIMIT = 50

/**
 * GET /api/admin/products/list — 페이지네이션 목록. 인증: 관리자.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1)
    const airline = searchParams.get('airline')?.trim() || null
    const destination = searchParams.get('destination')?.trim() || null
    const hasErrorOnly = searchParams.get('hasError') === '1'
    const status = searchParams.get('status')?.trim() || null
    const primaryRegion = searchParams.get('primaryRegion')?.trim() || null
    const displayCategory = searchParams.get('displayCategory')?.trim() || null
    const themeTags = searchParams.get('themeTags')?.trim() || null
    const imageSource = searchParams.get('imageSource')?.trim() || null
    const legacyOnly = searchParams.get('legacyOnly') === '1'
    const needsImageReview = searchParams.get('needsImageReview') === '1'

    const where: Prisma.ProductWhereInput = {}
    if (airline) where.airline = airline
    if (destination) where.destination = destination
    if (status && ['registered', 'on_hold', 'rejected', 'pending'].includes(status)) {
      if (status === 'pending') {
        where.OR = [
          { registrationStatus: null },
          { registrationStatus: '' },
          { registrationStatus: 'pending' },
        ]
      } else {
        where.registrationStatus = status
      }
    }
    if (primaryRegion) where.primaryRegion = { contains: primaryRegion }
    if (displayCategory) where.displayCategory = { contains: displayCategory }
    if (themeTags) where.themeTags = { contains: themeTags }
    if (hasErrorOnly) {
      const reports = await prisma.agentScrapeReport.findMany({
        where: { productId: { not: null } },
        select: { productId: true },
        distinct: ['productId'],
      })
      const errorProductIds = reports.map((r) => r.productId).filter((id): id is string => id != null)
      if (errorProductIds.length === 0) {
        return NextResponse.json({
          items: [],
          total: 0,
          page: 1,
          totalPages: 1,
          limit: LIMIT,
          imageKpi: { withImage: 0, legacy: 0, pexels: 0, gemini: 0, needsImageReviewCount: 0 },
        })
      }
      where.id = { in: errorProductIds }
    }

    // 이미지 출처 필터: legacy = 대표 이미지 있음 + source 없음/빈값
    const appendAnd = (clauses: Prisma.ProductWhereInput[]) => {
      const cur = where.AND
      const arr: Prisma.ProductWhereInput[] = Array.isArray(cur) ? [...cur] : cur ? [cur] : []
      arr.push(...clauses)
      where.AND = arr
    }
    const applyLegacyImageWhere = () => {
      appendAnd([
        { bgImageUrl: { not: null } },
        { OR: [{ bgImageSource: null }, { bgImageSource: '' }] },
      ])
    }
    if (imageSource === 'legacy' || (legacyOnly && !imageSource)) {
      applyLegacyImageWhere()
    } else if (imageSource) {
      where.bgImageSource = imageSource
    }
    if (needsImageReview) {
      appendAnd([{ needsImageReview: true }])
    }

    const andBase = (Array.isArray(where.AND) ? [...where.AND] : where.AND ? [where.AND] : []) as object[]
    const [total, items, countWithImage, countLegacy, countPexels, countGemini, countNeedsImageReview] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * LIMIT,
        take: LIMIT,
        select: {
          id: true,
          originSource: true,
          originCode: true,
          title: true,
          destination: true,
          destinationRaw: true,
          primaryDestination: true,
          supplierGroupId: true,
          priceFrom: true,
          priceCurrency: true,
          duration: true,
          airline: true,
          mandatoryLocalFee: true,
          schedule: true,
          registrationStatus: true,
          updatedAt: true,
          primaryRegion: true,
          displayCategory: true,
          themeTags: true,
          rejectReason: true,
          rejectedAt: true,
          bgImageUrl: true,
          bgImageSource: true,
          bgImageIsGenerated: true,
          needsImageReview: true,
          imageReviewRequestedAt: true,
          brand: { select: { brandKey: true } },
        },
      }),
      prisma.product.count({
        where: { ...where, AND: [...andBase, { bgImageUrl: { not: null } }] },
      }),
      prisma.product.count({
        where: {
          ...where,
          AND: [
            ...andBase,
            { bgImageUrl: { not: null } },
            { OR: [{ bgImageSource: null }, { bgImageSource: '' }] },
          ],
        },
      }),
      prisma.product.count({
        where: { ...where, AND: [...andBase, { bgImageSource: 'pexels' }] },
      }),
      prisma.product.count({
        where: { ...where, AND: [...andBase, { bgImageSource: 'gemini' }] },
      }),
      prisma.product.count({
        where: { ...where, AND: [...andBase, { needsImageReview: true }] },
      }),
    ])

    const productIds = items.map((p) => p.id)
    const errorProductIds = new Set(
      (
        await prisma.agentScrapeReport.findMany({
          where: { productId: { in: productIds } },
          select: { productId: true },
          distinct: ['productId'],
        })
      ).map((r) => r.productId).filter((id): id is string => id != null)
    )

    const totalPages = Math.max(1, Math.ceil(total / LIMIT))

    const rows = items.map((p) => {
      const supplierDeriv = computeAdminProductSupplierDerivatives({
        brandKey: p.brand?.brandKey ?? null,
        originSource: p.originSource,
      })
      return {
      id: p.id,
      originSource: p.originSource,
      canonicalBrandKey: supplierDeriv.canonicalBrandKey,
      normalizedOriginSupplier: supplierDeriv.normalizedOriginSupplier,
      originCode: p.originCode,
      title: p.title,
      destination: p.destination,
      destinationRaw: p.destinationRaw ?? null,
      primaryDestination: p.primaryDestination ?? null,
      supplierGroupId: p.supplierGroupId ?? null,
      priceFrom: p.priceFrom ?? null,
      priceCurrency: p.priceCurrency ?? null,
      duration: p.duration,
      airline: p.airline,
      mandatoryLocalFee: p.mandatoryLocalFee,
      schedule: p.schedule,
      registrationStatus: p.registrationStatus,
      updatedAt: p.updatedAt,
      hasError: errorProductIds.has(p.id),
      scheduleDays: countScheduleDays(p.schedule),
      primaryRegion: p.primaryRegion ?? null,
      displayCategory: p.displayCategory ?? null,
      themeTags: p.themeTags ?? null,
      rejectReason: p.rejectReason ?? null,
      rejectedAt: p.rejectedAt?.toISOString() ?? null,
      hasPrimaryImage: !!p.bgImageUrl,
      bgImageUrl: p.bgImageUrl ?? null,
      bgImageSource: p.bgImageSource ?? null,
      bgImageIsGenerated: p.bgImageIsGenerated ?? false,
      needsImageReview: p.needsImageReview ?? false,
      imageReviewRequestedAt: p.imageReviewRequestedAt?.toISOString() ?? null,
    }
    })

    return NextResponse.json({
      items: rows,
      total,
      page,
      totalPages,
      limit: LIMIT,
      imageKpi: {
        withImage: countWithImage,
        legacy: countLegacy,
        pexels: countPexels,
        gemini: countGemini,
        needsImageReviewCount: countNeedsImageReview,
      },
    })
  } catch (e) {
    console.error('products/list:', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
