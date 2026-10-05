import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { extractPdfText } from '@/lib/simplyur/trip-inbox/pdf-extract'
import {
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  parseOtaReceiptForInvoice,
  renderOtaCompanyCheckInVoucherHtml,
  renderOtaCompanyInvoiceHtml,
  type OtaAdminDocumentKind,
  type OtaInvoiceProfitMode,
} from '@/lib/bongtour-company-invoice'
import { resolveUsdKrwRateForDate, seoulYmd, usdAmountToKrw } from '@/lib/bongtour-usd-krw-rate'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024

/**
 * POST /api/admin/invoices/from-ota-receipt
 * Trip.com / Agoda 영수증·체크인 바우처 → 회사 인보이스(+이익) 또는 체크인 바우처
 * USD 금액은 입력일(rateDate) 환율로 KRW 환산
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스(+이익) — manifest
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  let text = ''
  let documentKind: OtaAdminDocumentKind = 'invoice'
  let profitMode: OtaInvoiceProfitMode = 'percent'
  let profitPercent = 15
  let profitFixedKrw = 0
  let guestNameOverride: string | null = null
  let propertyOverride: string | null = null
  let roomTypeOverride: string | null = null
  let checkInOverride: string | null = null
  let checkOutOverride: string | null = null
  let note = ''
  let sourceAmountOverride: number | null = null
  let amountUsd: number | null = null
  let rateDate: string | null = null

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
      documentKind = form.get('documentKind') === 'voucher' ? 'voucher' : 'invoice'
      profitMode = form.get('profitMode') === 'fixed' ? 'fixed' : 'percent'
      profitPercent = Number(form.get('profitPercent') ?? 15)
      profitFixedKrw = Number(form.get('profitFixedKrw') ?? 0)
      guestNameOverride =
        typeof form.get('guestName') === 'string' ? String(form.get('guestName')).trim() || null : null
      propertyOverride =
        typeof form.get('propertyName') === 'string'
          ? String(form.get('propertyName')).trim() || null
          : null
      roomTypeOverride =
        typeof form.get('roomType') === 'string' ? String(form.get('roomType')).trim() || null : null
      checkInOverride =
        typeof form.get('checkIn') === 'string' ? String(form.get('checkIn')).trim() || null : null
      checkOutOverride =
        typeof form.get('checkOut') === 'string' ? String(form.get('checkOut')).trim() || null : null
      note = typeof form.get('note') === 'string' ? String(form.get('note')).trim() : ''
      const overrideRaw = form.get('sourceAmountKrw')
      if (typeof overrideRaw === 'string' && overrideRaw.trim()) {
        const n = Number(overrideRaw.replace(/,/g, ''))
        if (Number.isFinite(n) && n > 0) sourceAmountOverride = Math.round(n)
      }
      const usdRaw = form.get('amountUsd')
      if (typeof usdRaw === 'string' && usdRaw.trim()) {
        const n = Number(usdRaw.replace(/,/g, ''))
        if (Number.isFinite(n) && n > 0) amountUsd = n
      }
      rateDate =
        typeof form.get('rateDate') === 'string' && String(form.get('rateDate')).trim()
          ? String(form.get('rateDate')).trim()
          : null
    } else {
      const body = (await request.json()) as Record<string, unknown>
      text = String(body.text ?? '')
      documentKind = body.documentKind === 'voucher' ? 'voucher' : 'invoice'
      profitMode = body.profitMode === 'fixed' ? 'fixed' : 'percent'
      profitPercent = Number(body.profitPercent ?? 15)
      profitFixedKrw = Number(body.profitFixedKrw ?? 0)
      guestNameOverride =
        typeof body.guestName === 'string' ? body.guestName.trim() || null : null
      propertyOverride =
        typeof body.propertyName === 'string' ? body.propertyName.trim() || null : null
      roomTypeOverride = typeof body.roomType === 'string' ? body.roomType.trim() || null : null
      checkInOverride = typeof body.checkIn === 'string' ? body.checkIn.trim() || null : null
      checkOutOverride = typeof body.checkOut === 'string' ? body.checkOut.trim() || null : null
      note = typeof body.note === 'string' ? body.note.trim() : ''
      if (body.sourceAmountKrw != null) {
        const n = Number(body.sourceAmountKrw)
        if (Number.isFinite(n) && n > 0) sourceAmountOverride = Math.round(n)
      }
      if (body.amountUsd != null) {
        const n = Number(body.amountUsd)
        if (Number.isFinite(n) && n > 0) amountUsd = n
      }
      rateDate = typeof body.rateDate === 'string' && body.rateDate.trim() ? body.rateDate.trim() : null
    }
  } catch {
    return NextResponse.json({ ok: false, error: '요청 본문을 읽지 못했습니다.' }, { status: 400 })
  }

  if (!text.trim()) {
    return NextResponse.json(
      { ok: false, error: '영수증/바우처 텍스트 또는 PDF가 필요합니다.' },
      { status: 400 },
    )
  }

  const parsed = parseOtaReceiptForInvoice(text)
  const fx = await resolveUsdKrwRateForDate(rateDate || seoulYmd())

  if (documentKind === 'voucher') {
    if (amountUsd == null || amountUsd <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error: '체크인 바우처는 amountUsd(달러)를 입력하세요. 입력일 환율로 원화 환산됩니다.',
          parsed,
          fx,
        },
        { status: 422 },
      )
    }
    const amountKrw = usdAmountToKrw(amountUsd, fx.usdKrw)
    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed,
      amountUsd,
      rateDate: fx.rateDate,
      effectiveRateDate: fx.effectiveDate,
      usdKrwRate: fx.usdKrw,
      amountKrw,
      guestNameOverride,
      propertyOverride,
      roomTypeOverride,
      checkInOverride,
      checkOutOverride,
      note,
    })
    return NextResponse.json({
      ok: true,
      documentKind: 'voucher',
      parsed,
      fx,
      draft,
      html: renderOtaCompanyCheckInVoucherHtml(draft),
    })
  }

  let sourceAmountKrw = sourceAmountOverride ?? parsed.sourceAmountKrw
  let sourceAmountUsd: number | null = null
  if (amountUsd != null && amountUsd > 0) {
    sourceAmountUsd = amountUsd
    sourceAmountKrw = usdAmountToKrw(amountUsd, fx.usdKrw)
  }

  if (sourceAmountKrw == null || sourceAmountKrw <= 0) {
    return NextResponse.json(
      {
        ok: false,
        error:
          '금액을 찾지 못했습니다. amountUsd(달러, 입력일 환율 적용) 또는 sourceAmountKrw를 입력하세요.',
        parsed,
        fx,
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
    sourceAmountUsd,
    rateDate: sourceAmountUsd != null ? fx.rateDate : null,
    usdKrwRate: sourceAmountUsd != null ? fx.usdKrw : null,
  })

  return NextResponse.json({
    ok: true,
    documentKind: 'invoice',
    parsed,
    fx,
    draft,
    html: renderOtaCompanyInvoiceHtml(draft),
  })
}
