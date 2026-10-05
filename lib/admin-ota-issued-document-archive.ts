/**
 * 관리자 OTA→회사 인보이스/체크인 바우처 발행 보관.
 * 발행 PDF·파싱 JSON은 DB/스토리지, OTA 원본 PDF/TXT는 Ncloud Object Storage.
 * REGRESSION-FREEZE[admin-ota-issued-archive]: OTA 발행 문서 보관 — manifest
 * REGRESSION-FREEZE[admin-ota-issued-pdf]: 발행본은 PDF로 보관 — manifest
 */
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import {
  getImageStorageBucket,
  isObjectStorageConfigured,
  readStorageObject,
  uploadStorageObjectRaw,
} from '@/lib/object-storage'
import type { OtaAdminDocumentKind } from '@/lib/bongtour-company-invoice'

export type OtaIssuedOriginalUpload = {
  fileName: string
  mimeType: string
  body: Buffer
}

export type PersistAdminOtaIssuedDocumentArgs = {
  documentKind: OtaAdminDocumentKind
  documentNumber: string
  provider: string | null
  bookingRef: string | null
  guestName: string | null
  propertyName: string | null
  amountUsd: number | null
  amountKrw: number | null
  rateDate: string | null
  usdKrwRate: number | null
  parsed: unknown
  draft: unknown
  issuedHtml: string
  htmlKo?: string | null
  htmlEn?: string | null
  /** 회사 발행 PDF (HTML→PDF). 있으면 스토리지에 issued.pdf로 보관 */
  issuedPdf?: Buffer | null
  issuedPdfFileName?: string | null
  sourceText: string
  note: string
  issuedByUserId: string | null
  originals: OtaIssuedOriginalUpload[]
}

export type PersistAdminOtaIssuedDocumentResult = {
  id: string
  documentNumber: string
  fileCount: number
  storageWarnings: string[]
}

/** admin-ota-docs/{yyyy-mm}/{documentId}/{n}-{safeName} */
export function buildAdminOtaOriginalObjectKey(args: {
  documentId: string
  index: number
  fileName: string
  now?: Date
}): string {
  const d = args.now ?? new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const safe = sanitizeOtaUploadFileName(args.fileName)
  const n = String(args.index + 1).padStart(2, '0')
  return `admin-ota-docs/${y}-${m}/${args.documentId}/${n}-${safe}`
}

export function sanitizeOtaUploadFileName(name: string): string {
  const base = String(name || 'upload.bin').split(/[/\\]/).pop() || 'upload.bin'
  const cleaned = base.replace(/[^\w.\uac00-\ud7a3()-]+/g, '_').slice(0, 120)
  return cleaned || 'upload.bin'
}

export async function persistAdminOtaIssuedDocument(
  args: PersistAdminOtaIssuedDocumentArgs,
): Promise<PersistAdminOtaIssuedDocumentResult> {
  const id = randomUUID().replace(/-/g, '')
  const storageWarnings: string[] = []
  const fileRows: Array<{
    role: string
    fileName: string
    mimeType: string
    byteSize: number
    storageBucket: string
    storagePath: string
  }> = []

  const bucket = getImageStorageBucket()
  const ym = (() => {
    const d = new Date()
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })()

  if (args.originals.length > 0 && !isObjectStorageConfigured()) {
    storageWarnings.push('object_storage_not_configured')
  } else {
    for (let i = 0; i < args.originals.length; i++) {
      const orig = args.originals[i]!
      const storagePath = buildAdminOtaOriginalObjectKey({
        documentId: id,
        index: i,
        fileName: orig.fileName,
      })
      try {
        await uploadStorageObjectRaw({
          objectKey: storagePath,
          body: orig.body,
          contentType: orig.mimeType || 'application/octet-stream',
        })
        fileRows.push({
          role: 'ota_original',
          fileName: sanitizeOtaUploadFileName(orig.fileName),
          mimeType: orig.mimeType || 'application/octet-stream',
          byteSize: orig.body.byteLength,
          storageBucket: bucket,
          storagePath,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        storageWarnings.push(`upload_failed:${orig.fileName}:${msg}`)
      }
    }
  }

  if (isObjectStorageConfigured() && args.issuedPdf && args.issuedPdf.byteLength > 0) {
    const pdfName = sanitizeOtaUploadFileName(args.issuedPdfFileName || 'issued.pdf')
    const pdfPath = `admin-ota-docs/${ym}/${id}/${pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`}`
    try {
      await uploadStorageObjectRaw({
        objectKey: pdfPath,
        body: args.issuedPdf,
        contentType: 'application/pdf',
      })
      fileRows.push({
        role: 'issued_pdf',
        fileName: pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`,
        mimeType: 'application/pdf',
        byteSize: args.issuedPdf.byteLength,
        storageBucket: bucket,
        storagePath: pdfPath,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      storageWarnings.push(`issued_pdf_upload_failed:${msg}`)
    }
  } else if (args.issuedPdf && args.issuedPdf.byteLength > 0 && !isObjectStorageConfigured()) {
    storageWarnings.push('object_storage_not_configured_for_issued_pdf')
  }

  // HTML은 DB(issuedHtml)에 보관. 스토리지 주 발행본은 PDF.
  if (isObjectStorageConfigured() && args.issuedHtml.trim() && !args.issuedPdf?.byteLength) {
    const htmlPath = `admin-ota-docs/${ym}/${id}/issued.html`
    try {
      await uploadStorageObjectRaw({
        objectKey: htmlPath,
        body: Buffer.from(args.issuedHtml, 'utf8'),
        contentType: 'text/html; charset=utf-8',
      })
      fileRows.push({
        role: 'issued_html',
        fileName: 'issued.html',
        mimeType: 'text/html; charset=utf-8',
        byteSize: Buffer.byteLength(args.issuedHtml, 'utf8'),
        storageBucket: bucket,
        storagePath: htmlPath,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      storageWarnings.push(`issued_html_upload_failed:${msg}`)
    }
  }

  await prisma.adminOtaIssuedDocument.create({
    data: {
      id,
      documentKind: args.documentKind,
      documentNumber: args.documentNumber,
      provider: args.provider,
      bookingRef: args.bookingRef,
      guestName: args.guestName,
      propertyName: args.propertyName,
      amountUsd: args.amountUsd,
      amountKrw: args.amountKrw,
      rateDate: args.rateDate,
      usdKrwRate: args.usdKrwRate,
      parsedJson: JSON.stringify(args.parsed),
      draftJson: JSON.stringify(args.draft),
      issuedHtml: args.issuedHtml,
      htmlKo: args.htmlKo ?? null,
      htmlEn: args.htmlEn ?? null,
      sourceText: args.sourceText || null,
      note: args.note || null,
      issuedByUserId: args.issuedByUserId,
      files: fileRows.length
        ? {
            create: fileRows,
          }
        : undefined,
    },
  })

  return {
    id,
    documentNumber: args.documentNumber,
    fileCount: fileRows.filter((f) => f.role === 'ota_original').length,
    storageWarnings,
  }
}

export async function listAdminOtaIssuedDocuments(args?: {
  take?: number
  documentKind?: OtaAdminDocumentKind | 'all'
  bookingRef?: string | null
}) {
  const take = Math.min(Math.max(args?.take ?? 50, 1), 200)
  const kind = args?.documentKind && args.documentKind !== 'all' ? args.documentKind : undefined
  const booking = args?.bookingRef?.trim() || undefined
  return prisma.adminOtaIssuedDocument.findMany({
    where: {
      ...(kind ? { documentKind: kind } : {}),
      ...(booking ? { bookingRef: { contains: booking } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      files: {
        select: {
          id: true,
          role: true,
          fileName: true,
          mimeType: true,
          byteSize: true,
        },
      },
    },
  })
}

export async function getAdminOtaIssuedDocument(id: string) {
  return prisma.adminOtaIssuedDocument.findUnique({
    where: { id },
    include: { files: true },
  })
}

export async function readAdminOtaIssuedDocumentFileBytes(args: {
  documentId: string
  fileId: string
}): Promise<{ fileName: string; mimeType: string; body: Buffer } | null> {
  const row = await prisma.adminOtaIssuedDocumentFile.findFirst({
    where: { id: args.fileId, documentId: args.documentId },
  })
  if (!row) return null
  const body = await readStorageObject(row.storagePath)
  return { fileName: row.fileName, mimeType: row.mimeType, body }
}
