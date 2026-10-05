import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  listAdminOtaIssuedDocuments,
  persistAdminOtaIssuedDocument,
  type OtaIssuedOriginalUpload,
} from '@/lib/admin-ota-issued-document-archive'
import {
  buildOtaIssuedPdfFileName,
  renderOtaIssuedHtmlToPdf,
  type OtaIssuedPdfScope,
} from '@/lib/bongtour-ota-issued-html-to-pdf'
import type {
  OtaAdminDocumentKind,
  OtaCompanyCheckInVoucherDraft,
  OtaCompanyInvoiceDraft,
  OtaReceiptParsedAmount,
} from '@/lib/bongtour-company-invoice'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
/** Playwright PDF 변환 여유 */
export const maxDuration = 120

const MAX_BYTES = 8 * 1024 * 1024

function readJsonField<T>(raw: FormDataEntryValue | null, label: string): T {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(`${label}가 비었습니다.`)
  }
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new Error(`${label} JSON을 읽지 못했습니다.`)
  }
}

function parsePdfScope(raw: FormDataEntryValue | null): OtaIssuedPdfScope {
  const v = typeof raw === 'string' ? raw.trim() : ''
  if (v === 'ko' || v === 'en' || v === 'both') return v
  return 'both'
}

/** GET /api/admin/invoices/issued?kind=voucher|invoice|all&bookingRef= */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.', items: [] }, { status: 401 })
  }

  try {
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const migrationHint =
      /AdminOtaIssuedDocument|does not exist|P2021|relation/i.test(msg)
        ? ' (DB 마이그레이션이 아직 적용되지 않았을 수 있습니다. prisma migrate deploy 확인)'
        : ''
    console.error('[admin-ota-issued-archive] list failed', msg)
    return NextResponse.json(
      { ok: false, error: `${msg}${migrationHint}`, items: [] },
      { status: 500 },
    )
  }
}

/**
 * POST /api/admin/invoices/issued — PDF 저장·보관.
 * FormData: draftJson, parsedJson, issuedHtml, htmlKo?, htmlEn?, pdfScope?, persist?, sourceText?, note?, file[]
 * REGRESSION-FREEZE[admin-ota-issued-archive]: OTA 발행 문서 보관 — manifest
 * REGRESSION-FREEZE[admin-ota-issued-pdf]: HTML→PDF 후 다운로드·보관 — manifest
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const form = await request.formData()
    const documentKind: OtaAdminDocumentKind =
      form.get('documentKind') === 'invoice' ? 'invoice' : 'voucher'
    const draft = readJsonField<OtaCompanyInvoiceDraft | OtaCompanyCheckInVoucherDraft>(
      form.get('draftJson'),
      'draftJson',
    )
    const parsed = readJsonField<OtaReceiptParsedAmount>(form.get('parsedJson'), 'parsedJson')
    const issuedHtml = typeof form.get('issuedHtml') === 'string' ? String(form.get('issuedHtml')) : ''
    if (!issuedHtml.trim()) {
      return NextResponse.json({ ok: false, error: '발행 HTML이 없습니다.' }, { status: 400 })
    }
    const htmlKo =
      typeof form.get('htmlKo') === 'string' ? String(form.get('htmlKo')) || null : null
    const htmlEn =
      typeof form.get('htmlEn') === 'string' ? String(form.get('htmlEn')) || null : null
    const sourceText =
      typeof form.get('sourceText') === 'string' ? String(form.get('sourceText')) : ''
    const note = typeof form.get('note') === 'string' ? String(form.get('note')).trim() : ''
    const pdfScope = parsePdfScope(form.get('pdfScope'))
    const shouldPersist = form.get('persist') !== '0'

    const originals: OtaIssuedOriginalUpload[] = []
    const files = [...form.getAll('file'), ...form.getAll('files')].filter(
      (f): f is File => f instanceof File && f.size > 0,
    )
    for (const file of files) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { ok: false, error: `파일은 8MB 이하여야 합니다: ${file.name}` },
          { status: 400 },
        )
      }
      originals.push({
        fileName: file.name || `upload-${originals.length + 1}.bin`,
        mimeType: file.type || 'application/octet-stream',
        body: Buffer.from(await file.arrayBuffer()),
      })
    }

    let documentNumber = ''
    let guestName: string | null = null
    let propertyName: string | null = null
    let amountUsd: number | null = null
    let amountKrw: number | null = null
    let rateDate: string | null = null
    let usdKrwRate: number | null = null

    if (documentKind === 'voucher' && 'voucherNumber' in draft) {
      const v = draft as OtaCompanyCheckInVoucherDraft
      documentNumber = v.voucherNumber
      guestName = v.guestName
      propertyName = v.propertyNameKo || v.propertyNameEn || v.propertyName || null
      amountUsd = v.amountUsd
      amountKrw = v.amountKrw
      rateDate = v.rateDate
      usdKrwRate = v.usdKrwRate
    } else if ('invoiceNumber' in draft) {
      const inv = draft as OtaCompanyInvoiceDraft
      documentNumber = inv.invoiceNumber
      guestName = inv.guestName
      propertyName = inv.serviceDescription || parsed.propertyOrService || null
      amountUsd = inv.sourceAmountUsd
      amountKrw = inv.totalKrw
      rateDate = inv.rateDate
      usdKrwRate = inv.usdKrwRate
    } else {
      return NextResponse.json({ ok: false, error: '문서 종류와 draft가 맞지 않습니다.' }, { status: 400 })
    }

    if (!documentNumber) {
      return NextResponse.json({ ok: false, error: '문서 번호가 없습니다.' }, { status: 400 })
    }

    const pdfHtml =
      pdfScope === 'ko'
        ? htmlKo || issuedHtml
        : pdfScope === 'en'
          ? htmlEn || issuedHtml
          : issuedHtml
    const issuedPdf = await renderOtaIssuedHtmlToPdf(pdfHtml)
    const pdfFileName = buildOtaIssuedPdfFileName({ documentNumber, scope: pdfScope })

    let saved: Awaited<ReturnType<typeof persistAdminOtaIssuedDocument>> | null = null
    if (shouldPersist) {
      saved = await persistAdminOtaIssuedDocument({
        documentKind,
        documentNumber,
        provider: parsed.provider ?? null,
        bookingRef: parsed.bookingRef ?? null,
        guestName,
        propertyName,
        amountUsd,
        amountKrw,
        rateDate,
        usdKrwRate,
        parsed,
        draft,
        issuedHtml,
        htmlKo,
        htmlEn,
        issuedPdf,
        issuedPdfFileName: pdfFileName,
        sourceText,
        note,
        issuedByUserId: admin.user?.id ?? null,
        originals,
      })
    }

    return NextResponse.json({
      ok: true,
      saved,
      pdfBase64: issuedPdf.toString('base64'),
      pdfFileName,
      pdfScope,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin-ota-issued-archive] save failed', msg)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
