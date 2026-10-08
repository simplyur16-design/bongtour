/**
 * 서버 전용 — 바우처 HTML에 로고를 data URL로 임베드.
 * 클라이언트 번들에 node:fs가 끌려가지 않도록 lib/bongtour-company-invoice.ts 와 분리.
 * REGRESSION-FREEZE[admin-ota-receipt-invoice]: OTA 바우처 로고 서버 임베드 — manifest
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  collectAirAirlineIataCodesFromFlights,
  resolveBongtourLogoUrl,
} from '@/lib/bongtour-company-invoice'

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

/**
 * IATA 항공사 로고 → data URL (PDF setContent 시 상대경로 깨짐 방지).
 * REGRESSION-FREEZE[admin-ota-air-voucher]: loadAirAirlineLogoDataUrlMap — manifest
 */
export function loadAirAirlineLogoDataUrl(code: string): string | null {
  const c = String(code ?? '').trim().toUpperCase()
  if (!/^(?:[A-Z]{2}|[A-Z]\d|\d[A-Z])$/.test(c)) return null
  try {
    const p = join(process.cwd(), 'public', 'images', 'airlines', `${c}.png`)
    if (!existsSync(p)) return null
    const buf = readFileSync(p)
    if (!buf.length) return null
    return `data:image/png;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export function loadAirAirlineLogoDataUrlMap(codes: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of codes) {
    const c = String(raw ?? '').trim().toUpperCase()
    if (!c || out[c]) continue
    const data = loadAirAirlineLogoDataUrl(c)
    if (data) out[c] = data
  }
  return out
}

export function loadAirAirlineLogoDataUrlsForFlights(
  flights: ReadonlyArray<{ flightNo: string; airline: string | null }>,
): Record<string, string> {
  return loadAirAirlineLogoDataUrlMap(collectAirAirlineIataCodesFromFlights(flights))
}
