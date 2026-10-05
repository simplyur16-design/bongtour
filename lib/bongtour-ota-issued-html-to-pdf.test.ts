/**
 * REGRESSION-FREEZE[admin-ota-issued-pdf]: PDF 파일명·scope — manifest
 */
import { describe, expect, it } from 'vitest'
import { buildOtaIssuedPdfFileName } from '@/lib/bongtour-ota-issued-html-to-pdf'

describe('bongtour-ota-issued-html-to-pdf', () => {
  it('buildOtaIssuedPdfFileName encodes document number and scope', () => {
    expect(
      buildOtaIssuedPdfFileName({ documentNumber: 'BT-VCH-20261005-1234', scope: 'both' }),
    ).toBe('BT-VCH-20261005-1234-KO-EN.pdf')
    expect(
      buildOtaIssuedPdfFileName({ documentNumber: 'BT-VCH-20261005-1234', scope: 'ko' }),
    ).toBe('BT-VCH-20261005-1234-KO.pdf')
    expect(
      buildOtaIssuedPdfFileName({ documentNumber: 'BT INV/1', scope: 'en' }),
    ).toBe('BT_INV_1-EN.pdf')
  })
})
