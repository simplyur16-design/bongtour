/**
 * OTA 발행 HTML → PDF (Playwright Chromium).
 * REGRESSION-FREEZE[admin-ota-issued-pdf]: HTML→PDF 발행 — manifest
 */
import type { Browser } from 'playwright'

export type OtaIssuedPdfScope = 'both' | 'ko' | 'en'

export function buildOtaIssuedPdfFileName(args: {
  documentNumber: string
  scope: OtaIssuedPdfScope
}): string {
  const safe = String(args.documentNumber || 'document')
    .replace(/[^\w.\uac00-\ud7a3()-]+/g, '_')
    .slice(0, 80)
  const suffix = args.scope === 'both' ? 'KO-EN' : args.scope.toUpperCase()
  return `${safe || 'document'}-${suffix}.pdf`
}

/** HTML 문자열을 A4 PDF 버퍼로 변환. */
export async function renderOtaIssuedHtmlToPdf(html: string): Promise<Buffer> {
  const raw = String(html || '').trim()
  if (!raw) throw new Error('PDF로 변환할 HTML이 없습니다.')

  // 동적 import — Next webpack이 playwright를 번들하지 않도록 (serverExternalPackages)
  const { chromium } = await import('playwright')

  let browser: Browser | null = null
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
    const page = await browser.newPage()
    await page.setContent(raw, { waitUntil: 'networkidle', timeout: 60_000 })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    })
    return Buffer.from(pdf)
  } finally {
    if (browser) await browser.close().catch(() => undefined)
  }
}
