/**
 * 서버 전용 — 바우처 HTML에 로고를 data URL로 임베드.
 * 클라이언트 번들에 node:fs가 끌려가지 않도록 lib/bongtour-company-invoice.ts 와 분리.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 바우처 로고 서버 임베드 — manifest
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveBongtourLogoUrl } from '@/lib/bongtour-company-invoice'

/** 인쇄·미리보기용 — 네트워크 깨짐 방지로 PNG를 data URL로 임베드 */
export function loadBongtourLogoDataUrl(): string {
  try {
    const candidates = [
      join(process.cwd(), 'public', 'images', 'bongtour-logo.png'),
      join(process.cwd(), 'public', 'images', 'bongtour-logo.webp'),
    ]
    for (const p of candidates) {
      if (!existsSync(p)) continue
      const buf = readFileSync(p)
      if (!buf.length) continue
      const mime = p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/webp'
      return `data:${mime};base64,${buf.toString('base64')}`
    }
  } catch {
    /* fall through */
  }
  return resolveBongtourLogoUrl()
}
