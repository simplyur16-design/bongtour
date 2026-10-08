import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { extractPdfText } from '@/lib/simplyur/trip-inbox/pdf-extract'
import {
  extractAirlineEticketPdfTextViaGemini,
  extractOtaVoucherPdfTextViaGemini,
  isUsableExtractedPdfText,
} from '@/lib/bongtour-ota-voucher-pdf-ocr'
import {
  airlineEticketParsedToOtaReceiptStub,
  buildOtaCompanyAirVoucherDraft,
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  parseAdminAirlineEticketText,
  parseOtaAdminDocumentKind,
  parseOtaReceiptForInvoice,
  joinOtaVoucherUploadTexts,
  normalizeOtaCompanyInvoiceFees,
  otaProviderDisplayName,
  otaVoucherNoteNeedsEnglishTranslation,
  renderOtaCompanyAirVoucherBilingualHtml,
  renderOtaCompanyAirVoucherHtml,
  renderOtaCompanyCheckInVoucherBilingualHtml,
  renderOtaCompanyCheckInVoucherHtml,
  renderOtaCompanyInvoiceHtml,
  resolveLockedOtaAmountFromParsed,
  type OtaAdminDocumentKind,
  type OtaCompanyInvoiceFees,
} from '@/lib/bongtour-company-invoice'
import {
  loadAirAirlineLogoDataUrlsForFlights,
  loadBongtourLogoDataUrl,
} from '@/lib/bongtour-company-invoice-logo-server'
import { translateOtaVoucherNoteToEn } from '@/lib/bongtour-ota-voucher-note-translate'
import { resolveUsdKrwRateForDate, seoulYmd, usdAmountToKrw } from '@/lib/bongtour-usd-krw-rate'

export const runtime = 'nodejs'
/** 스캔 e-ticket Gemini OCR(모델 폴백 포함)이 길 수 있음 */
export const maxDuration = 300

const MAX_BYTES = 8 * 1024 * 1024

function isImageFile(name: string, type: string): boolean {
  if (type.startsWith('image/')) return true
  return /\.(png|jpe?g|webp|gif|heic|bmp)$/i.test(name)
}

function readNonNegNumber(raw: unknown): number {
  if (typeof raw !== 'string' && typeof raw !== 'number') return 0
  const n = Number(String(raw).replace(/,/g, '').trim())
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n)
}

function readBool(raw: unknown): boolean {
  if (typeof raw === 'boolean') return raw
  if (typeof raw === 'string') {
    const v = raw.trim().toLowerCase()
    return v === '1' || v === 'true' || v === 'yes' || v === 'on'
  }
  return false
}

function readFeesFromForm(form: FormData): Partial<OtaCompanyInvoiceFees> {
  return {
    hotelReservationFeeKrw: readNonNegNumber(form.get('hotelReservationFeeKrw')),
    airTicketingFeeKrw: readNonNegNumber(form.get('airTicketingFeeKrw')),
    travelInsuranceKrw: readNonNegNumber(form.get('travelInsuranceKrw')),
    visaApplied: readBool(form.get('visaApplied')),
    visaFeeKrw: readNonNegNumber(form.get('visaFeeKrw')),
    visaAgencyFeeKrw: readNonNegNumber(form.get('visaAgencyFeeKrw')),
  }
}

function readFeesFromBody(body: Record<string, unknown>): Partial<OtaCompanyInvoiceFees> {
  return {
    hotelReservationFeeKrw: readNonNegNumber(body.hotelReservationFeeKrw),
    airTicketingFeeKrw: readNonNegNumber(body.airTicketingFeeKrw),
    travelInsuranceKrw: readNonNegNumber(body.travelInsuranceKrw),
    visaApplied: readBool(body.visaApplied),
    visaFeeKrw: readNonNegNumber(body.visaFeeKrw),
    visaAgencyFeeKrw: readNonNegNumber(body.visaAgencyFeeKrw),
  }
}

async function extractTextFromBuffer(
  buf: Uint8Array,
  name: string,
  mime: string,
  documentKind: OtaAdminDocumentKind,
): Promise<{ text: string; hint: 'ok' | 'pdf_empty' | 'image' | 'unsupported'; error?: string }> {
  if (buf.byteLength > MAX_BYTES) {
    return { text: '', hint: 'unsupported', error: '파일은 8MB 이하여야 합니다.' }
  }
  const lowerName = (name || '').toLowerCase()
  const lowerMime = (mime || '').toLowerCase()
  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) {
    try {
      const extracted = extractPdfText(buf)
      // REGRESSION-FREEZE[admin-ota-air-voucher]: 스캔 PDF 제어문자만 있으면 OCR — manifest
      if (isUsableExtractedPdfText(extracted)) return { text: extracted, hint: 'ok' }
      const ocr =
        documentKind === 'air_voucher'
          ? await extractAirlineEticketPdfTextViaGemini(buf)
          : await extractOtaVoucherPdfTextViaGemini(buf)
      if (ocr.ok && ocr.text.trim()) return { text: ocr.text, hint: 'ok' }
      return { text: '', hint: 'pdf_empty' }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { text: '', hint: 'unsupported', error: `PDF 텍스트 추출 실패: ${msg}` }
    }
  }
  if (lowerName.endsWith('.txt') || lowerMime.includes('text')) {
    return { text: new TextDecoder().decode(buf), hint: 'ok' }
  }
  if (isImageFile(lowerName, lowerMime)) return { text: '', hint: 'image' }
  return {
    text: '',
    hint: 'unsupported',
    error:
      documentKind === 'air_voucher'
        ? 'PDF·TXT만 자동 읽습니다. 이미지면 e-ticket 본문(승객명·편명·PNR)을 붙여넣으세요.'
        : 'PDF·TXT만 자동 읽습니다. 이미지면 바우처 본문을 붙여넣으세요(예약·숙소·조식 추출용).',
  }
}

/**
 * POST /api/admin/invoices/from-ota-receipt
 * Trip.com / Agoda PDF·본문 → 숙박정보 추출 + 봉투어 인보이스/체크인 바우처
 * OTA 금액은 파싱값만(하드잠금). 인보이스만 회사 수수료 라인 가산.
 * 한글+영문 바우처 PDF는 한 세트로 여러 파일 업로드 가능.
 * 보관은 인쇄(POST /api/admin/invoices/issued) 시에만 수행.
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
  let rateDate: string | null = null
  let feesInput: Partial<OtaCompanyInvoiceFees> = {}
  let fileHint: 'none' | 'pdf_empty' | 'image' | 'ok' = 'none'
  let uploadedFileCount = 0

  const contentType = request.headers.get('content-type') || ''
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      documentKind = parseOtaAdminDocumentKind(form.get('documentKind'))
      const pasted = typeof form.get('text') === 'string' ? String(form.get('text')) : ''
      const uploadParts: string[] = []
      const files = [
        ...form.getAll('file'),
        ...form.getAll('files'),
      ].filter((f): f is File => f instanceof File && f.size > 0)
      uploadedFileCount = files.length
      for (const file of files) {
        const body = Buffer.from(await file.arrayBuffer())
        const extracted = await extractTextFromBuffer(
          body,
          file.name || '',
          file.type || '',
          documentKind,
        )
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
                (documentKind === 'air_voucher'
                  ? 'PDF·TXT만 자동 읽습니다. 이미지면 e-ticket 본문(승객명·편명·PNR)을 붙여넣으세요.'
                  : 'PDF·TXT만 자동 읽습니다. 이미지면 바우처 본문을 붙여넣으세요(예약·숙소·조식 추출용).'),
            },
            { status: 400 },
          )
        }
      }
      text = joinOtaVoucherUploadTexts([pasted, ...uploadParts])
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
      rateDate =
        typeof form.get('rateDate') === 'string' && String(form.get('rateDate')).trim()
          ? String(form.get('rateDate')).trim()
          : null
      feesInput = readFeesFromForm(form)
      // amountUsd / nightRateUsd / sourceAmountKrw 클라이언트 값은 무시(하드잠금)
    } else {
      const body = (await request.json()) as Record<string, unknown>
      text = String(body.text ?? '')
      documentKind = parseOtaAdminDocumentKind(body.documentKind)
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
      rateDate = typeof body.rateDate === 'string' && body.rateDate.trim() ? body.rateDate.trim() : null
      feesInput = readFeesFromBody(body)
    }
  } catch {
    return NextResponse.json({ ok: false, error: '요청 본문을 읽지 못했습니다.' }, { status: 400 })
  }

  if (!text.trim()) {
    if (fileHint === 'image') {
      return NextResponse.json(
        {
          ok: false,
          error:
            documentKind === 'air_voucher'
              ? '이미지 파일은 자동 읽기를 지원하지 않습니다. e-ticket 본문(승객명·편명·PNR)을 붙여넣으세요.'
              : '이미지 파일은 자동 읽기를 지원하지 않습니다. 바우처 본문(예약번호·숙소·조식 등)을 붙여넣으세요.',
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
    return NextResponse.json(
      {
        ok: false,
        error:
          documentKind === 'air_voucher'
            ? '항공사 e-ticket PDF/본문을 올려 승객·편명·PNR을 가져오세요.'
            : 'OTA 바우처 PDF/본문을 넣어 예약·숙소·금액을 가져오세요. 한글+영문 바우처는 한 세트로 함께 업로드하세요.',
      },
      { status: 400 },
    )
  }

  // REGRESSION-FREEZE[admin-ota-air-voucher]: air_voucher는 OTA 금액·Booking ID·OTA 로고 없이 e-ticket만 — manifest
  if (documentKind === 'air_voucher') {
    const airParsed = parseAdminAirlineEticketText(text)
    // OTA 예약번호(Booking ID) / OTA 로고·명칭은 요구하지 않음. 승객명만 필수.
    if (!airParsed.passengers.length && !guestNameOverride) {
      return NextResponse.json(
        {
          ok: false,
          error:
            '승객명을 e-ticket에서 찾지 못했습니다. Passenger Name을 붙여넣거나 승객 이름 칸에 입력하세요. (OTA 예약번호는 필요 없습니다)',
          airParsed,
        },
        { status: 422 },
      )
    }
    let noteEnOverride: string | null = null
    let noteTranslateWarning: string | null = null
    if (note && otaVoucherNoteNeedsEnglishTranslation(note)) {
      try {
        noteEnOverride = await translateOtaVoucherNoteToEn(note)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        noteTranslateWarning = `비고 영문 번역 실패: ${msg}`
        console.error('[from-ota-receipt] air note translate failed', msg)
      }
    }
    const logoUrl = loadBongtourLogoDataUrl()
    const airlineLogoUrls = loadAirAirlineLogoDataUrlsForFlights(airParsed.flights)
    const draft = buildOtaCompanyAirVoucherDraft({
      parsed: airParsed,
      guestNameOverride,
      note,
      noteEnOverride,
      logoUrl,
      airlineLogoUrls,
    })
    const htmlKo = renderOtaCompanyAirVoucherHtml(draft, 'ko')
    const htmlEn = renderOtaCompanyAirVoucherHtml(draft, 'en')
    const html = renderOtaCompanyAirVoucherBilingualHtml(draft)
    const parsed = airlineEticketParsedToOtaReceiptStub(airParsed)
    if (draft.guestName) parsed.guestName = draft.guestName
    return NextResponse.json({
      ok: true,
      documentKind: 'air_voucher',
      parsed,
      airParsed,
      draft,
      html,
      htmlKo,
      htmlEn,
      ...(noteTranslateWarning ? { warning: noteTranslateWarning } : {}),
    })
  }

  const parsed = parseOtaReceiptForInvoice(text)
  const locked = resolveLockedOtaAmountFromParsed(parsed)
  if (!locked) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'OTA 결제 금액을 원문에서 찾지 못했습니다. 총액(USD/KRW) 또는 1박·박수가 보이게 PDF/본문을 다시 올리세요. 수동 금액 입력은 불가합니다.',
        code: 'ota_amount_required',
        parsed,
      },
      { status: 400 },
    )
  }

  // USD→KRW: OTA 결제당일 환율 우선. 못 읽으면 관리자 결제일 폴백.
  const fxDate = parsed.paymentDate || rateDate || seoulYmd()
  const fx = await resolveUsdKrwRateForDate(fxDate)
  const logoUrl = loadBongtourLogoDataUrl()

  if (documentKind === 'voucher') {
    let totalUsd = locked.totalUsd
    let amountKrw: number
    if (totalUsd != null && totalUsd > 0) {
      amountKrw = usdAmountToKrw(totalUsd, fx.usdKrw)
    } else if (locked.amountKrwDirect != null && locked.amountKrwDirect > 0) {
      amountKrw = locked.amountKrwDirect
      totalUsd = Math.round((amountKrw / fx.usdKrw) * 100) / 100
    } else {
      return NextResponse.json(
        {
          ok: false,
          error:
            'OTA 결제 금액을 원문에서 찾지 못했습니다. 총액(USD/KRW) 또는 1박·박수가 보이게 PDF/본문을 다시 올리세요.',
          code: 'ota_amount_required',
          parsed,
          fx,
        },
        { status: 400 },
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
      locked.nightRateUsd ??
      (parsed.nights && parsed.nights > 0
        ? Math.round((totalUsd / parsed.nights) * 100) / 100
        : null)

    let noteEnOverride: string | null = null
    let noteTranslateWarning: string | null = null
    if (note && otaVoucherNoteNeedsEnglishTranslation(note)) {
      try {
        noteEnOverride = await translateOtaVoucherNoteToEn(note)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        noteTranslateWarning = `비고 영문 번역 실패: ${msg}`
        console.error('[from-ota-receipt] note translate failed', msg)
      }
    }
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
      noteEnOverride,
      logoUrl,
    })
    const htmlKo = renderOtaCompanyCheckInVoucherHtml(draft, 'ko')
    const htmlEn = renderOtaCompanyCheckInVoucherHtml(draft, 'en')
    const html = renderOtaCompanyCheckInVoucherBilingualHtml(draft)
    return NextResponse.json({
      ok: true,
      documentKind: 'voucher',
      parsed,
      lockedAmount: locked,
      fx,
      paymentDateUsed: fxDate,
      paymentDateFromOta: Boolean(parsed.paymentDate),
      draft,
      html,
      htmlKo,
      htmlEn,
      ...(noteTranslateWarning ? { warning: noteTranslateWarning } : {}),
      otaProvider: otaProviderDisplayName(parsed.provider),
    })
  }

  const fees = normalizeOtaCompanyInvoiceFees(feesInput)
  let sourceAmountUsd: number | null = locked.totalUsd
  let sourceAmountKrw: number
  if (locked.totalUsd != null && locked.totalUsd > 0) {
    sourceAmountKrw = usdAmountToKrw(locked.totalUsd, fx.usdKrw)
  } else if (locked.amountKrwDirect != null && locked.amountKrwDirect > 0) {
    sourceAmountKrw = locked.amountKrwDirect
    sourceAmountUsd = null
  } else {
    return NextResponse.json(
      {
        ok: false,
        error:
          'OTA 결제 금액을 원문에서 찾지 못했습니다. 총액(USD/KRW) 또는 1박·박수가 보이게 PDF/본문을 다시 올리세요.',
        code: 'ota_amount_required',
        parsed,
        fx,
      },
      { status: 400 },
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
    fees,
  })
  const html = renderOtaCompanyInvoiceHtml(draft)

  return NextResponse.json({
    ok: true,
    documentKind: 'invoice',
    parsed,
    lockedAmount: locked,
    fx,
    paymentDateUsed: fxDate,
    paymentDateFromOta: Boolean(parsed.paymentDate),
    draft,
    html,
  })
}
