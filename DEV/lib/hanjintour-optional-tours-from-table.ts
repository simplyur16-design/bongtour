/**
 * 운영자가 붙여넣은 선택관광 표(탭/콤마 구분) → 구조화. 본문보다 표를 SSOT로 둔다.
 */
import type { HanjintourOptionalTourStructuredRow } from '@/DEV/lib/hanjintour-types'

function pickNumber(s: string): number | null {
  const m = s.match(/(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

function pickCurrency(label: string): string | null {
  if (/USD|미국\s*달러/u.test(label)) return 'USD'
  if (/CAD|캐나다\s*달러/u.test(label)) return 'CAD'
  if (/KRW|원/u.test(label)) return 'KRW'
  return null
}

/**
 * 한 줄: `도시\t이름\t가격...\t소요...\t대체...` 또는 콤마 구분 변형.
 */
export function parseHanjintourOptionalTourTableSsot(tableText: string): HanjintourOptionalTourStructuredRow[] {
  const rows: HanjintourOptionalTourStructuredRow[] = []
  const lines = tableText.split(/\r?\n/u).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^도시/u.test(line)) continue
    const parts = line.split(/\t/u).map((p) => p.trim())
    if (parts.length < 3) continue
    const [city, option_name, priceCol, durationCol, replacementCol] = [
      parts[0],
      parts[1],
      parts[2],
      parts[3] ?? null,
      parts[4] ?? null,
    ]
    if (!city || !option_name || !priceCol) continue
    const price_text = priceCol
    const price_value = pickNumber(priceCol)
    const currency = pickCurrency(priceCol)
    const duration_text = durationCol && durationCol.length > 0 ? durationCol : null
    const replacement_schedule = replacementCol && replacementCol.length > 0 ? replacementCol : null
    rows.push({
      city,
      option_name,
      price_text,
      price_value,
      currency,
      duration_text,
      replacement_schedule,
    })
  }
  return rows
}

export function optionalTourRowsToSummary(rows: HanjintourOptionalTourStructuredRow[]): string {
  if (rows.length === 0) return ''
  const bits = rows.map(
    (r) => `${r.city}·${r.option_name}(${r.price_text}${r.duration_text ? `, ${r.duration_text}` : ''})`
  )
  return `선택관광 표 SSOT ${rows.length}건: ${bits.join(' | ')}`.slice(0, 4000)
}
