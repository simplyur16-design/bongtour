/**
 * REGRESSION-FREEZE[admin-ota-issued-archive]: OTA 발행 문서 보관 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  buildAdminOtaOriginalObjectKey,
  sanitizeOtaUploadFileName,
} from '@/lib/admin-ota-issued-document-archive'

describe('admin-ota-issued-document-archive', () => {
  it('sanitizeOtaUploadFileName keeps basename and strips path/unsafe chars', () => {
    expect(sanitizeOtaUploadFileName('../../a b/체크인(KO).pdf')).toBe('체크인(KO).pdf')
    expect(sanitizeOtaUploadFileName('')).toBe('upload.bin')
  })

  it('buildAdminOtaOriginalObjectKey uses admin-ota-docs prefix and padded index', () => {
    const key = buildAdminOtaOriginalObjectKey({
      documentId: 'doc1',
      index: 0,
      fileName: 'voucher EN.pdf',
      now: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(key).toBe('admin-ota-docs/2026-10/doc1/01-voucher_EN.pdf')
  })
})
