import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { extractPdfText } from '@/lib/simplyur/trip-inbox/pdf-extract'
import {
  buildOtaCompanyInvoiceDraft,
  parseOtaReceiptForInvoice,
  renderOtaCompanyInvoiceHtml,
  type OtaInvoiceProfitMode,
} from '@/lib/bongtour-company-invoice'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024

/**
 * POST /api/admin/invoices/from-ota-receipt
 * Trip.com / Agoda 영수증 텍스트·PDF → 회사 인보이스(+이익)
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스(+이익) — manifest
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  let text = ''
  let profitMode: OtaInvoiceProfitMode = 'percent'
  let profitPercent = 15
  let profitFixedKrw = 0
  let guestNameOverride: string | null = null
  let note = ''
  let sourceAmountOverride: number | null = null

  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const pasted = typeof form.get('text') === 'string' ? String(form.get('text')) : ''
      text = pasted
      const file = form.get('file')
      if (file instanceof File && file.size > 0) {
        if (file.size > MAX_BYTES) {
          return NextResponse.json({ ok: false, error: '파일은 8MB 이하여야 합니다.' }, { status: 400 })
        }
        const buf = new Uint8Array(await file.arrayBuffer())
        const name = (file.name || '').toLowerCase()
        if (name.endsWith('.pdf') || (file.type || '').includes('pdf')) {
          try {
            const extracted = extractPdfText(buf)
            text = [text, extracted].filter(Boolean).join('\n\n')
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            return NextResponse.json(
              { ok: false, error: `PDF 텍스트 추출 실패: ${msg}` },
              { status: 400 },
            )
          }
        } else if (name.endsWith('.txt') || (file.type || '').includes('text')) {
          text = [text, new TextDecoder().decode(buf)].filter(Boolean).join('\n\n')
        } else {
          return NextResponse.json(
            { ok: false, error: 'PDF 또는 텍스트 파일만 지원합니다. (이미지 OCR은 추후)' },
            { status: 400 },
          )
        }
      }
      profitMode = form.get('profitMode') === 'fixed' ? 'fixed' : 'percent'
      profitPercent = Number(form.get('profitPercent') ?? 15)
      profitFixedKrw = Number(form.get('profitFixedKrw') ?? 0)
      guestNameOverride =
        typeof form.get('guestName') === 'string' ? String(form.get('guestName')).trim() || null : null
      note = typeof form.get('note') === 'string' ? String(form.get('note')).trim() : ''
      const overrideRaw = form.get('sourceAmountKrw')
      if (typeof overrideRaw === 'string' && overrideRaw.trim()) {
        const n = Number(overrideRaw.replace(/,/g, ''))
        if (Number.isFinite(n) && n > 0) sourceAmountOverride = Math.round(n)
      }
    } else {
      const body = (await request.json()) as Record<string, unknown>
      text = String(body.text ?? '')
      profitMode = body.profitMode === 'fixed' ? 'fixed' : 'percent'
      profitPercent = Number(body.profitPercent ?? 15)
      profitFixedKrw = Number(body.profitFixedKrw ?? 0)
      guestNameOverride =
        typeof body.guestName === 'string' ? body.guestName.trim() || null : null
      note = typeof body.note === 'string' ? body.note.trim() : ''
      if (body.sourceAmountKrw != null) {
        const n = Number(body.sourceAmountKrw)
        if (Number.isFinite(n) && n > 0) sourceAmountOverride = Math.round(n)
      }
    }
  } catch {
    return NextResponse.json({ ok: false, error: '요청 본문을 읽지 못했습니다.' }, { status: 400 })
  }

  if (!text.trim()) {
    return NextResponse.json({ ok: false, error: '영수증 텍스트 또는 PDF가 필요합니다.' }, { status: 400 })
  }

  const parsed = parseOtaReceiptForInvoice(text)
  const sourceAmountKrw = sourceAmountOverride ?? parsed.sourceAmountKrw
  if (sourceAmountKrw == null || sourceAmountKrw <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error: '영수증에서 금액을 찾지 못했습니다. sourceAmountKrw를 직접 입력하세요.',
        parsed,
      },
      { status: 422 },
    )
  }

  const draft = buildOtaCompanyInvoiceDraft({
    parsed,
    sourceAmountKrw,
    profitMode,
    profitPercent: Number.isFinite(profitPercent) ? profitPercent : 15,
    profitFixedKrw: Number.isFinite(profitFixedKrw) ? profitFixedKrw : 0,
    guestNameOverride,
    note,
  })

  return NextResponse.json({
    ok: true,
    parsed,
    draft,
    html: renderOtaCompanyInvoiceHtml(draft),
  })
}
