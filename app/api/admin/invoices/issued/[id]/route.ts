import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getAdminOtaIssuedDocument } from '@/lib/admin-ota-issued-document-archive'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/invoices/issued/[id] — 발행 HTML 재조회 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id } = await ctx.params
  const row = await getAdminOtaIssuedDocument(id)
  if (!row) {
    return NextResponse.json({ ok: false, error: '문서를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json({
    ok: true,
    item: {
      id: row.id,
      documentKind: row.documentKind,
      documentNumber: row.documentNumber,
      provider: row.provider,
      bookingRef: row.bookingRef,
      guestName: row.guestName,
      propertyName: row.propertyName,
      amountUsd: row.amountUsd,
      amountKrw: row.amountKrw,
      rateDate: row.rateDate,
      usdKrwRate: row.usdKrwRate,
      issuedHtml: row.issuedHtml,
      htmlKo: row.htmlKo,
      htmlEn: row.htmlEn,
      sourceText: row.sourceText,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      files: row.files.map((f) => ({
        id: f.id,
        role: f.role,
        fileName: f.fileName,
        mimeType: f.mimeType,
        byteSize: f.byteSize,
      })),
    },
  })
}
