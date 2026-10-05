import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { listAdminOtaIssuedDocuments } from '@/lib/admin-ota-issued-document-archive'
import type { OtaAdminDocumentKind } from '@/lib/bongtour-company-invoice'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/invoices/issued?kind=voucher|invoice|all&bookingRef= */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const kindRaw = (searchParams.get('kind') || 'all').trim()
  const kind =
    kindRaw === 'invoice' || kindRaw === 'voucher' || kindRaw === 'all'
      ? (kindRaw as OtaAdminDocumentKind | 'all')
      : 'all'
  const bookingRef = searchParams.get('bookingRef')

  const rows = await listAdminOtaIssuedDocuments({
    documentKind: kind,
    bookingRef,
    take: 80,
  })

  return NextResponse.json({
    ok: true,
    items: rows.map((r) => ({
      id: r.id,
      documentKind: r.documentKind,
      documentNumber: r.documentNumber,
      provider: r.provider,
      bookingRef: r.bookingRef,
      guestName: r.guestName,
      propertyName: r.propertyName,
      amountUsd: r.amountUsd,
      amountKrw: r.amountKrw,
      rateDate: r.rateDate,
      createdAt: r.createdAt.toISOString(),
      files: r.files,
    })),
  })
}
