import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { explainMainVisibilityForRow, parseCurationPatchBody, type AdminMonthlyCurationListItem } from '@/lib/admin-curation'
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
 * PATCH /api/admin/curations/monthly/[id]
 * 부분 수정. 존재하지 않으면 404. linkedProductId 설정 시 Product 존재 확인(null은 해제).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  }

  const existing = await prisma.monthlyCurationItem.findUnique({ where: { id }, select: { id: true } })
  if (!existing) {
    return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }

  const parsed = parseCurationPatchBody(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: '입력값을 확인해 주세요.', fieldErrors: parsed.errors }, { status: 400 })
  }

  if ('linkedProductId' in parsed.patch) {
    const lp = parsed.patch.linkedProductId as string | null
    const productCheck = await ensureProductId(lp)
    if (!productCheck.ok) {
      return NextResponse.json({ error: productCheck.message, fieldErrors: { linkedProductId: productCheck.message } }, { status: 400 })
    }
  }

  try {
    const updated = await prisma.monthlyCurationItem.update({
      where: { id },
      data: parsed.patch,
      select: selectList,
    })
    return NextResponse.json({ item: rowToDto(updated) })
  } catch (e) {
    console.error('[PATCH /api/admin/curations/monthly/[id]]', e)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }
}
