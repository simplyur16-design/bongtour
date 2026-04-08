import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  explainMainVisibilityForRow,
  parseAdminCurationListQuery,
  parseCurationCreateBody,
  type AdminMonthlyCurationListItem,
} from '@/lib/admin-curation'
import { requireAdmin } from '@/lib/require-admin'

const selectList = {
  id: true,
  yearMonth: true,
  scope: true,
  destinationName: true,
  oneLineTheme: true,
  whyNowText: true,
  recommendedForText: true,
  leadTimeLabel: true,
  primaryInquiryType: true,
  briefingSourceType: true,
  linkedProductId: true,
  sortOrder: true,
  status: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  linkedProduct: { select: { id: true, title: true } },
} as const

function rowToDto(
  row: {
    id: string
    yearMonth: string
    scope: string
    destinationName: string
    oneLineTheme: string
    whyNowText: string
    recommendedForText: string
    leadTimeLabel: string
    primaryInquiryType: string
    briefingSourceType: string
    linkedProductId: string | null
    sortOrder: number
    status: string
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    linkedProduct: { id: string; title: string } | null
  }
): AdminMonthlyCurationListItem {
  const mainVisibility = explainMainVisibilityForRow({ status: row.status, isActive: row.isActive })
  return {
    id: row.id,
    yearMonth: row.yearMonth,
    scope: row.scope,
    destinationName: row.destinationName,
    oneLineTheme: row.oneLineTheme,
    whyNowText: row.whyNowText,
    recommendedForText: row.recommendedForText,
    leadTimeLabel: row.leadTimeLabel,
    primaryInquiryType: row.primaryInquiryType,
    briefingSourceType: row.briefingSourceType,
    linkedProductId: row.linkedProductId,
    sortOrder: row.sortOrder,
    status: row.status,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    linkedProduct: row.linkedProduct,
    mainVisibility,
  }
}

async function ensureProductId(id: string | null): Promise<{ ok: true } | { ok: false; message: string }> {
  if (id == null) return { ok: true }
  const p = await prisma.product.findUnique({ where: { id }, select: { id: true } })
  if (!p) return { ok: false, message: '연결할 상품 ID가 존재하지 않습니다.' }
  return { ok: true }
}

/**
 * GET /api/admin/curations/monthly
 * Query: scope?, status?, isActive?, yearMonth? — 허용값만, 그 외 400
 * 정렬: yearMonth desc → sortOrder asc → updatedAt desc
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const parsed = parseAdminCurationListQuery(searchParams)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const rows = await prisma.monthlyCurationItem.findMany({
      where: parsed.where,
      orderBy: [{ yearMonth: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
      select: selectList,
    })
    const items: AdminMonthlyCurationListItem[] = rows.map((r) => rowToDto(r))
    return NextResponse.json({ items, appliedFilters: parsed.applied })
  } catch (e) {
    console.error('[GET /api/admin/curations/monthly]', e)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
}

/**
 * POST /api/admin/curations/monthly
 * 본문 검증 실패 400, linkedProductId 있으면 Product 존재 확인
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const parsed = parseCurationCreateBody(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: '입력값을 확인해 주세요.', fieldErrors: parsed.errors }, { status: 400 })
  }

  const { data } = parsed
  const productCheck = await ensureProductId(data.linkedProductId)
  if (!productCheck.ok) {
    return NextResponse.json({ error: productCheck.message, fieldErrors: { linkedProductId: productCheck.message } }, { status: 400 })
  }

  try {
    const created = await prisma.monthlyCurationItem.create({
      data: {
        yearMonth: data.yearMonth,
        scope: data.scope,
        destinationName: data.destinationName,
        oneLineTheme: data.oneLineTheme,
        whyNowText: data.whyNowText,
        recommendedForText: data.recommendedForText,
        leadTimeLabel: data.leadTimeLabel,
        primaryInquiryType: data.primaryInquiryType,
        briefingSourceType: data.briefingSourceType,
        linkedProductId: data.linkedProductId,
        sortOrder: data.sortOrder,
        status: data.status,
        isActive: data.isActive,
      },
      select: selectList,
    })
    return NextResponse.json({ item: rowToDto(created) }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/admin/curations/monthly]', e)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }
}
