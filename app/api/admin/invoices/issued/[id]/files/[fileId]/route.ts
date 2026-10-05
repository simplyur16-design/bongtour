import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { readAdminOtaIssuedDocumentFileBytes } from '@/lib/admin-ota-issued-document-archive'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** GET /api/admin/invoices/issued/[id]/files/[fileId] — OTA 원본·발행 HTML 다운로드 */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string; fileId: string }> },
) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { id, fileId } = await ctx.params
  try {
    const file = await readAdminOtaIssuedDocumentFileBytes({ documentId: id, fileId })
    if (!file) {
      return NextResponse.json({ ok: false, error: '파일을 찾을 수 없습니다.' }, { status: 404 })
    }
    const disposition = `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
    return new NextResponse(new Uint8Array(file.body), {
      status: 200,
      headers: {
        'Content-Type': file.mimeType || 'application/octet-stream',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
