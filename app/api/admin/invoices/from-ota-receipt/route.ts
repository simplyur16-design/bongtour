import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { extractPdfText } from '@/lib/simplyur/trip-inbox/pdf-extract'
import { extractOtaVoucherPdfTextViaGemini } from '@/lib/bongtour-ota-voucher-pdf-ocr'
import {
  buildOtaCompanyCheckInVoucherDraft,
  buildOtaCompanyInvoiceDraft,
  parseOtaReceiptForInvoice,
  joinOtaVoucherUploadTexts,
  computeVoucherTotalUsdFromNightRate,
  renderOtaCompanyCheckInVoucherBilingualHtml,
  renderOtaCompanyCheckInVoucherHtml,
  renderOtaCompanyInvoiceHtml,
  type OtaAdminDocumentKind,
} from '@/lib/bongtour-company-invoice'
import { loadBongtourLogoDataUrl } from '@/lib/bongtour-company-invoice-logo-server'
import { resolveUsdKrwRateForDate, seoulYmd, usdAmountToKrw } from '@/lib/bongtour-usd-krw-rate'
import {
  persistAdminOtaIssuedDocument,
  type OtaIssuedOriginalUpload,
} from '@/lib/admin-ota-issued-document-archive'

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

async function extractTextFromBuffer(
  buf: Uint8Array,
  name: string,
  mime: string,
): Promise<{ text: string; hint: 'ok' | 'pdf_empty' | 'image' | 'unsupported'; error?: string }> {
  if (buf.byteLength > MAX_BYTES) {
    return { text: '', hint: 'unsupported', error: '파일은 8MB 이하여야 합니다.' }
  }
  const lowerName = (name || '').toLowerCase()
  const lowerMime = (mime || '').toLowerCase()
  if (lowerName.endsWith('.pdf') || lowerMime.includes('pdf')) {
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
  if (lowerName.endsWith('.txt') || lowerMime.includes('text')) {
    return { text: new TextDecoder().decode(buf), hint: 'ok' }
  }
  if (isImageFile(lowerName, lowerMime)) return { text: '', hint: 'image' }
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
 * 발행 성공 시 HTML·OTA 원본을 DB/스토리지에 자동 보관.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 영수증→회사 인보이스 — manifest
 * REGRESSION-FREEZE[admin-ota-issued-archive]: OTA 발행 문서 보관 — manifest
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
  const originals: OtaIssuedOriginalUpload[] = []

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
        const body = Buffer.from(await file.arrayBuffer())
        originals.push({
          fileName: file.name || `upload-${originals.length + 1}.bin`,
          mimeType: file.type || 'application/octet-stream',
          body,
        })
        const extracted = await extractTextFromBuffer(body, file.name || '', file.type || '')
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
  const logoUrl = loadBongtourLogoDataUrl()
  const issuedByUserId = admin.user?.id ?? null

  async function saveIssued(args: {
    documentKind: OtaAdminDocumentKind
    documentNumber: string
    draft: unknown
    issuedHtml: string
    htmlKo?: string | null
    htmlEn?: string | null
    amountUsd: number | null
    amountKrw: number | null
    guestName: string | null
    propertyName: string | null
  }) {
    try {
      const saved = await persistAdminOtaIssuedDocument({
        documentKind: args.documentKind,
        documentNumber: args.documentNumber,
        provider: parsed.provider,
        bookingRef: parsed.bookingRef,
        guestName: args.guestName,
        propertyName: args.propertyName,
        amountUsd: args.amountUsd,
        amountKrw: args.amountKrw,
        rateDate: fx.rateDate,
        usdKrwRate: fx.usdKrw,
        parsed,
        draft: args.draft,
        issuedHtml: args.issuedHtml,
        htmlKo: args.htmlKo,
        htmlEn: args.htmlEn,
        sourceText: text,
        note,
        issuedByUserId,
        originals,
      })
      return { saved, saveError: null as string | null }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[admin-ota-issued-archive] persist failed', msg)
      return { saved: null, saveError: msg }
    }
  }

  if (documentKind === 'voucher') {
    const fromNight = computeVoucherTotalUsdFromNightRate(nightRateUsd, parsed.nights)
    const fromParsedNight = computeVoucherTotalUsdFromNightRate(
      parsed.nightRateUsd,
      parsed.nights,
    )
    let totalUsd =
      fromNight ??
      (amountUsd != null && amountUsd > 0 ? amountUsd : null) ??
      parsed.totalUsd ??
      fromParsedNight

    if (totalUsd == null || totalUsd <= 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            '1박 USD를 입력하세요. PDF에서 확인한 박수로 총액(1박×박수)을 계산합니다. 또는 총액 USD를 직접 입력하세요.',
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
    const { saved, saveError } = await saveIssued({
      documentKind: 'voucher',
      documentNumber: draft.voucherNumber,
      draft,
      issuedHtml: html,
      htmlKo,
      htmlEn,
      amountUsd: totalUsd,
      amountKrw,
      guestName: draft.guestName,
      propertyName:
        draft.propertyNameKo || draft.propertyNameEn || draft.propertyName || null,
    })
    return NextResponse.json({
      ok: true,
      documentKind: 'voucher',
      parsed,
      fx,
      draft,
      html,
      htmlKo,
      htmlEn,
      saved,
      saveError,
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
  const html = renderOtaCompanyInvoiceHtml(draft)
  const { saved, saveError } = await saveIssued({
    documentKind: 'invoice',
    documentNumber: draft.invoiceNumber,
    draft,
    issuedHtml: html,
    amountUsd: sourceAmountUsd,
    amountKrw: draft.totalKrw,
    guestName: draft.guestName,
    propertyName: draft.serviceDescription || parsed.propertyOrService || null,
  })

  return NextResponse.json({
    ok: true,
    documentKind: 'invoice',
    parsed,
    fx,
    draft,
    html,
    saved,
    saveError,
  })
}
