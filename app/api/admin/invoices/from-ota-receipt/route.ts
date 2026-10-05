import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { extractPdfText } from '@/lib/simplyur/trip-inbox/pdf-extract'
import { extractOtaVoucherPdfTextViaGemini } from '@/lib/bongtour-ota-voucher-pdf-ocr'
import {
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  parseOtaReceiptForInvoice,
  joinOtaVoucherUploadTexts,
  renderOtaCompanyCheckInVoucherBilingualHtml,
  renderOtaCompanyCheckInVoucherHtml,
  renderOtaCompanyInvoiceHtml,
  resolveBongtourLogoUrl,
  type OtaAdminDocumentKind,
} from '@/lib/bongtour-company-invoice'
import { resolveUsdKrwRateForDate, seoulYmd, usdAmountToKrw } from '@/lib/bongtour-usd-krw-rate'

export const runtime = 'nodejs'

const MAX_BYTES = 8 * 1024 * 1024

function isImageFile(name: string, type: string): boolean {
  if (type.startsWith('image/')) return true
  return /\.(png|jpe?g|webp|gif|heic|bmp)$/i.test(name)
}

function readPositiveNumber(raw: unknown): number | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null
  const n = Number(String(raw).replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

async function extractTextFromUploadedFile(
  file: File,
): Promise<{ text: string; hint: 'ok' | 'pdf_empty' | 'image' | 'unsupported'; error?: string }> {
  if (file.size > MAX_BYTES) {
    return { text: '', hint: 'unsupported', error: '파일은 8MB 이하여야 합니다.' }
  }
  const buf = new Uint8Array(await file.arrayBuffer())
  const name = (file.name || '').toLowerCase()
  const mime = (file.type || '').toLowerCase()
  if (name.endsWith('.pdf') || mime.includes('pdf')) {
    try {
      const extracted = extractPdfText(buf)
      if (extracted.trim()) return { text: extracted, hint: 'ok' }
      const ocr = await extractOtaVoucherPdfTextViaGemini(buf)
      if (ocr.ok && ocr.text.trim()) return { text: ocr.text, hint: 'ok' }
      return { text: '', hint: 'pdf_empty' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { text: '', hint: 'unsupported', error: `PDF 텍스트 추출 실패: ${msg}` }
    }
  }
  if (name.endsWith('.txt') || mime.includes('text')) {
    return { text: new TextDecoder().decode(buf), hint: 'ok' }
  }
  if (isImageFile(name, mime)) return { text: '', hint: 'image' }
  return {
    text: '',
    hint: 'unsupported',
    error: 'PDF·TXT만 자동 읽습니다. 이미지면 바우처 본문을 붙여넣으세요(예약·숙소·조식 추출용).',
  }
}

/**
 * POST /api/admin/invoices/from-ota-receipt
 * Trip.com / Agoda PDF·본문 → 숙박정보 추출 + 봉투어 인보이스/체크인 바우처
 * 금액(1박·총액)은 입력값이 최종. 서비스요금·세금은 포함 문구로 명시.
 * 한글+영문 바우처 PDF는 한 세트로 여러 파일 업로드 가능.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스 — manifest
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  let text = ''
  let documentKind: OtaAdminDocumentKind = 'invoice'
  let guestNameOverride: string | null = null
  let propertyOverride: string | null = null
  let propertyNameKoOverride: string | null = null
  let propertyNameEnOverride: string | null = null
  let roomTypeOverride: string | null = null
  let checkInOverride: string | null = null
  let checkOutOverride: string | null = null
  let note = ''
  let sourceAmountOverride: number | null = null
  let amountUsd: number | null = null
  let nightRateUsd: number | null = null
  let rateDate: string | null = null
  let fileHint: 'none' | 'pdf_empty' | 'image' | 'ok' = 'none'
  let uploadedFileCount = 0

  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const pasted = typeof form.get('text') === 'string' ? String(form.get('text')) : ''
      const uploadParts: string[] = []
      const files = [
        ...form.getAll('file'),
        ...form.getAll('files'),
      ].filter((f): f is File => f instanceof File && f.size > 0)
      uploadedFileCount = files.length
      for (const file of files) {
        const extracted = await extractTextFromUploadedFile(file)
        if (extracted.error) {
          return NextResponse.json({ ok: false, error: extracted.error }, { status: 400 })
        }
        if (extracted.hint === 'ok' && extracted.text.trim()) {
          uploadParts.push(extracted.text)
          fileHint = 'ok'
        } else if (extracted.hint === 'pdf_empty' && fileHint !== 'ok') {
          fileHint = 'pdf_empty'
        } else if (extracted.hint === 'image' && fileHint !== 'ok') {
          fileHint = 'image'
        } else if (extracted.hint === 'unsupported') {
          return NextResponse.json(
            {
              ok: false,
              error:
                extracted.error ||
                'PDF·TXT만 자동 읽습니다. 이미지면 바우처 본문을 붙여넣으세요(예약·숙소·조식 추출용).',
            },
            { status: 400 },
          )
        }
      }
      text = joinOtaVoucherUploadTexts([pasted, ...uploadParts])
      documentKind = form.get('documentKind') === 'voucher' ? 'voucher' : 'invoice'
      guestNameOverride =
        typeof form.get('guestName') === 'string' ? String(form.get('guestName')).trim() || null : null
      propertyOverride =
        typeof form.get('propertyName') === 'string'
          ? String(form.get('propertyName')).trim() || null
          : null
      propertyNameKoOverride =
        typeof form.get('propertyNameKo') === 'string'
          ? String(form.get('propertyNameKo')).trim() || null
          : null
      propertyNameEnOverride =
        typeof form.get('propertyNameEn') === 'string'
          ? String(form.get('propertyNameEn')).trim() || null
          : null
      roomTypeOverride =
        typeof form.get('roomType') === 'string' ? String(form.get('roomType')).trim() || null : null
      checkInOverride =
        typeof form.get('checkIn') === 'string' ? String(form.get('checkIn')).trim() || null : null
      checkOutOverride =
        typeof form.get('checkOut') === 'string' ? String(form.get('checkOut')).trim() || null : null
      note = typeof form.get('note') === 'string' ? String(form.get('note')).trim() : ''
      sourceAmountOverride = readPositiveNumber(form.get('sourceAmountKrw'))
      amountUsd = readPositiveNumber(form.get('amountUsd'))
      nightRateUsd = readPositiveNumber(form.get('nightRateUsd'))
      rateDate =
        typeof form.get('rateDate') === 'string' && String(form.get('rateDate')).trim()
          ? String(form.get('rateDate')).trim()
          : null
    } else {
      const body = (await request.json()) as Record<string, unknown>
      text = String(body.text ?? '')
      documentKind = body.documentKind === 'voucher' ? 'voucher' : 'invoice'
      guestNameOverride =
        typeof body.guestName === 'string' ? body.guestName.trim() || null : null
      propertyOverride =
        typeof body.propertyName === 'string' ? body.propertyName.trim() || null : null
      propertyNameKoOverride =
        typeof body.propertyNameKo === 'string' ? body.propertyNameKo.trim() || null : null
      propertyNameEnOverride =
        typeof body.propertyNameEn === 'string' ? body.propertyNameEn.trim() || null : null
      roomTypeOverride = typeof body.roomType === 'string' ? body.roomType.trim() || null : null
      checkInOverride = typeof body.checkIn === 'string' ? body.checkIn.trim() || null : null
      checkOutOverride = typeof body.checkOut === 'string' ? body.checkOut.trim() || null : null
      note = typeof body.note === 'string' ? body.note.trim() : ''
      sourceAmountOverride = readPositiveNumber(body.sourceAmountKrw)
      amountUsd = readPositiveNumber(body.amountUsd)
      nightRateUsd = readPositiveNumber(body.nightRateUsd)
      rateDate = typeof body.rateDate === 'string' && body.rateDate.trim() ? body.rateDate.trim() : null
    }
  } catch {
    return NextResponse.json({ ok: false, error: '요청 본문을 읽지 못했습니다.' }, { status: 400 })
  }

  const hasManualAmount =
    (amountUsd != null && amountUsd > 0) ||
    (documentKind === 'invoice' && sourceAmountOverride != null && sourceAmountOverride > 0)

  if (!text.trim()) {
    if (fileHint === 'image') {
      return NextResponse.json(
        {
          ok: false,
          error:
            '이미지 파일은 자동 읽기를 지원하지 않습니다. 바우처 본문(예약번호·숙소·조식 등)을 붙여넣으세요.',
        },
        { status: 400 },
      )
    }
    if (fileHint === 'pdf_empty') {
      return NextResponse.json(
        {
          ok: false,
          error:
            uploadedFileCount > 1
              ? '업로드한 한글/영문 PDF에서 텍스트/OCR을 읽지 못했습니다. 본문 붙여넣기 또는 GEMINI_API_KEY를 확인하세요.'
              : 'PDF에서 텍스트/OCR을 읽지 못했습니다. 바우처 본문을 붙여넣거나 GEMINI_API_KEY를 확인하세요.',
        },
        { status: 400 },
      )
    }
    if (!hasManualAmount) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'OTA 바우처 PDF/본문을 넣어 예약·숙소 정보를 가져오세요. 한글+영문 바우처는 한 세트로 함께 업로드하세요.',
        },
        { status: 400 },
      )
    }
  }

  const parsed = parseOtaReceiptForInvoice(text)
  const fx = await resolveUsdKrwRateForDate(rateDate || seoulYmd())
  const logoUrl = resolveBongtourLogoUrl(
    (() => {
      try {
        return new URL(request.url).origin
      } catch {
        return null
      }
    })(),
  )

  if (documentKind === 'voucher') {
    let totalUsd = amountUsd
    if ((totalUsd == null || totalUsd <= 0) && parsed.totalUsd != null) totalUsd = parsed.totalUsd
    if (
      (totalUsd == null || totalUsd <= 0) &&
      nightRateUsd != null &&
      parsed.nights != null &&
      parsed.nights > 0
    ) {
      totalUsd = Math.round(nightRateUsd * parsed.nights * 100) / 100
    }
    if (
      (totalUsd == null || totalUsd <= 0) &&
      parsed.nightRateUsd != null &&
      parsed.nights != null &&
      parsed.nights > 0
    ) {
      totalUsd = Math.round(parsed.nightRateUsd * parsed.nights * 100) / 100
    }

    if (totalUsd == null || totalUsd <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            '체크인 바우처는 총액 USD(또는 1박 USD×박수)가 필요합니다. PDF에서 숙박정보는 추출하되 판매 금액은 입력하세요.',
          parsed,
          fx,
        },
        { status: 422 },
      )
    }

    if (!parsed.bookingRef) {
      return NextResponse.json(
        {
          ok: false,
          error:
            'Booking ID(예약번호)를 원문에서 찾지 못했습니다. 바우처 본문에 Booking ID가 보이게 붙여넣거나 PDF를 다시 확인하세요.',
          parsed,
          fx,
        },
        { status: 422 },
      )
    }

    const resolvedNight =
      nightRateUsd ??
      parsed.nightRateUsd ??
      (parsed.nights && parsed.nights > 0
        ? Math.round((totalUsd / parsed.nights) * 100) / 100
        : null)

    const amountKrw = usdAmountToKrw(totalUsd, fx.usdKrw)
    const draft = buildOtaCompanyCheckInVoucherDraft({
      parsed,
      amountUsd: totalUsd,
      nightRateUsd: resolvedNight,
      rateDate: fx.rateDate,
      effectiveRateDate: fx.effectiveDate,
      usdKrwRate: fx.usdKrw,
      amountKrw,
      nightRateKrw: resolvedNight != null ? usdAmountToKrw(resolvedNight, fx.usdKrw) : null,
      guestNameOverride,
      propertyOverride,
      propertyNameKoOverride,
      propertyNameEnOverride,
      roomTypeOverride,
      checkInOverride,
      checkOutOverride,
      note,
      logoUrl,
    })
    const htmlKo = renderOtaCompanyCheckInVoucherHtml(draft, 'ko')
    const htmlEn = renderOtaCompanyCheckInVoucherHtml(draft, 'en')
    const html = renderOtaCompanyCheckInVoucherBilingualHtml(draft)
    return NextResponse.json({
      ok: true,
      documentKind: 'voucher',
      parsed,
      fx,
      draft,
      html,
      htmlKo,
      htmlEn,
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
          '금액을 찾지 못했습니다. amountUsd(달러) 또는 sourceAmountKrw를 입력하세요.',
        parsed,
        fx,
      },
      { status: 422 },
    )
  }

  const draft = buildOtaCompanyInvoiceDraft({
    parsed,
    sourceAmountKrw,
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
